-- Run with Perfetto trace_processor query -f this-file.sql capture.pftrace.
-- The input stays local. Native GPU submissions are not application-frame markers.
SELECT name, str_value FROM metadata WHERE name IN ('trace_uuid', 'android_build_fingerprint');
SELECT (end_ts-start_ts)/1e9 AS duration_seconds FROM trace_bounds;
SELECT (SELECT count(*) FROM perf_sample) AS perf_samples,
       (SELECT count(*) FROM cpu_profile_stack_sample) AS javascript_stack_samples,
       (SELECT count(*) FROM android_logs) AS android_log_records;

CREATE PERFETTO TABLE nh3d_threads AS
SELECT t.utid,t.tid,t.name,p.name AS process
FROM thread t JOIN process p USING(upid)
WHERE p.name GLOB 'com.nethack3d.quest.vr*';

SELECT t.process,t.tid,t.name,round(sum(s.dur)/1e9,3) AS cpu_seconds
FROM sched s JOIN nh3d_threads t USING(utid)
WHERE s.dur>0 GROUP BY s.utid ORDER BY cpu_seconds DESC LIMIT 20;

CREATE PERFETTO TABLE nh3d_content_thread AS
SELECT t.utid FROM sched s JOIN nh3d_threads t USING(utid)
WHERE t.name GLOB 'Isolated Web Co*' AND s.dur>0
GROUP BY t.utid ORDER BY sum(s.dur) DESC LIMIT 1;

SELECT state,round(sum(dur)/1e9,3) AS seconds,round(max(dur)/1e6,3) AS max_ms
FROM thread_state WHERE utid IN (SELECT utid FROM nh3d_content_thread) AND dur>0 GROUP BY state;

-- Exclude timestamp=0 reservation records; keep the actual queued submissions.
CREATE PERFETTO TABLE nh3d_native_gpu_queue AS
SELECT f.ts,extract_arg(f.arg_set_id,'id') AS context
FROM ftrace_event f JOIN nh3d_threads t USING(utid)
WHERE f.name='kgsl_adreno_cmdbatch_queued' AND t.name='VRB Render'
  AND extract_arg(f.arg_set_id,'timestamp')>0;

CREATE PERFETTO TABLE nh3d_submission_gaps AS
SELECT ts,dur FROM (
  SELECT ts,lead(ts) OVER(PARTITION BY context ORDER BY ts)-ts AS dur
  FROM nh3d_native_gpu_queue
) WHERE dur>70000000;

SELECT round((g.ts-b.start_ts)/1e9,3) AS start_seconds,round(g.dur/1e6,3) AS gap_ms,
  round(sum(CASE WHEN t.state='Running' THEN min(t.ts+t.dur,g.ts+g.dur)-max(t.ts,g.ts) ELSE 0 END)/1e6,3) AS content_running_ms,
  round(sum(CASE WHEN t.state IN ('R','R+') THEN min(t.ts+t.dur,g.ts+g.dur)-max(t.ts,g.ts) ELSE 0 END)/1e6,3) AS content_ready_ms,
  round(sum(CASE WHEN t.state='S' THEN min(t.ts+t.dur,g.ts+g.dur)-max(t.ts,g.ts) ELSE 0 END)/1e6,3) AS content_sleep_ms
FROM nh3d_submission_gaps g CROSS JOIN trace_bounds b
JOIN thread_state t ON t.utid IN (SELECT utid FROM nh3d_content_thread) AND t.dur>0
  AND t.ts<g.ts+g.dur AND t.ts+t.dur>g.ts
GROUP BY g.ts ORDER BY gap_ms DESC LIMIT 20;

-- Attribute collection overhead rather than assigning it to the game.
SELECT p.name,p.cmdline,parent.name AS parent,count(*) AS processes
FROM process p LEFT JOIN process parent ON p.parent_upid=parent.upid
WHERE p.name IN ('getprop','dumpsys','/system/bin/sh','grep','cmd','app_process')
GROUP BY p.name,p.cmdline,parent.name ORDER BY processes DESC LIMIT 25;

SELECT p.name,round(sum(s.dur)/1e9,3) AS cpu_seconds
FROM sched s JOIN thread t USING(utid) JOIN process p USING(upid)
WHERE s.dur>0 GROUP BY p.name ORDER BY cpu_seconds DESC LIMIT 20;

SELECT name,value FROM stats WHERE severity='error' AND value>0;
