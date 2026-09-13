package com.igalia.wolvic;

import android.content.Context;
import android.content.res.AssetManager;
import android.util.Log;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import org.json.JSONArray;

/** A fixed loopback origin for the bundled game, workers and persistent saves. */
public final class BundledGameServer {
    public static final String ORIGIN = "http://127.0.0.1:18973";
    private static ServerSocket listener;
    private static ExecutorService workers;
    private static volatile float[] uiPose;
    public static float[] getUiPose() { return uiPose; }
    private BundledGameServer() {}

    public static synchronized void start(Context context) {
        if (listener != null) return;
        final AssetManager assets = context.getApplicationContext().getAssets();
        try {
            final ServerSocket socket = new ServerSocket();
            socket.setReuseAddress(true);
            socket.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), 18973));
            listener = socket;
            workers = new ThreadPoolExecutor(2, 4, 30, TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(64), new ThreadPoolExecutor.AbortPolicy());
            final ExecutorService pool = workers;
            Thread accept = new Thread(() -> {
                while (!socket.isClosed()) {
                    try {
                        final Socket client = socket.accept();
                        try { pool.execute(() -> serve(assets, client)); }
                        catch (RejectedExecutionException busy) { client.close(); }
                    } catch (IOException error) {
                        if (!socket.isClosed()) Log.e("QuestWebXR", "Bundled server failed", error);
                    }
                }
            }, "nh3d-bundled-assets");
            accept.setDaemon(true);
            accept.start();
        } catch (IOException error) {
            throw new IllegalStateException("Cannot open the bundled game origin", error);
        }
    }

    public static synchronized void stop() {
        try { if (listener != null) listener.close(); } catch (IOException ignored) {}
        listener = null;
        uiPose = null;
        if (workers != null) workers.shutdownNow();
        workers = null;
    }

    private static void serve(AssetManager assets, Socket client) {
        try (Socket socket = client) {
            socket.setSoTimeout(10000);
            BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.US_ASCII));
            String request = line(reader);
            if (request == null) return;
            String[] parts = request.split(" ");
            if (parts.length != 3 || !(parts[0].equals("GET") || parts[0].equals("HEAD") || parts[0].equals("POST"))) {
                status(socket, 405, "Method Not Allowed"); return;
            }
            String host = "", header;
            String origin = "";
            int contentLength = 0;
            int headerCount = 0;
            while ((header = line(reader)) != null && !header.isEmpty()) {
                if (++headerCount > 64) throw new IOException("Too many headers");
                int colon = header.indexOf(':');
                if (colon > 0 && header.substring(0, colon).equalsIgnoreCase("Host")) host = header.substring(colon + 1).trim();
                if (colon > 0 && header.substring(0, colon).equalsIgnoreCase("Origin")) origin = header.substring(colon + 1).trim();
                if (colon > 0 && header.substring(0, colon).equalsIgnoreCase("Content-Length")) contentLength = Integer.parseInt(header.substring(colon + 1).trim());
            }
            if (!host.equals("127.0.0.1:18973")) { status(socket, 403, "Forbidden"); return; }
            String path = new URI(parts[1]).getPath();
            if (parts[0].equals("POST")) {
                if (!"/__xr/pane".equals(path) || !ORIGIN.equals(origin) || contentLength < 1 || contentLength > 2048) {
                    status(socket, 403, "Forbidden"); return;
                }
                char[] body = new char[contentLength];
                int offset = 0;
                while (offset < body.length) {
                    int read = reader.read(body, offset, body.length - offset);
                    if (read < 0) throw new IOException("Incomplete pane pose");
                    offset += read;
                }
                JSONArray values = new JSONArray(new String(body));
                if (values.length() != 17) throw new IOException("Invalid pane pose");
                float[] pose = new float[17];
                for (int i = 0; i < pose.length; i++) {
                    pose[i] = (float)values.getDouble(i);
                    if (!Float.isFinite(pose[i]) || Math.abs(pose[i]) > 10000) throw new IOException("Invalid pane coordinate");
                }
                if (pose[16] < 0.5f || pose[16] > 5.0f) throw new IOException("Invalid pane width");
                uiPose = pose;
                status(socket, 204, "No Content"); return;
            }
            if (path == null || !path.startsWith("/") || path.contains("\\") || path.indexOf('\0') >= 0) {
                status(socket, 400, "Bad Request"); return;
            }
            for (String segment : path.split("/")) if (segment.equals("..") || segment.equals(".")) {
                status(socket, 403, "Forbidden"); return;
            }
            if (path.equals("/")) path = "/index.html";
            try (InputStream stream = assets.open("game" + path, AssetManager.ACCESS_STREAMING)) {
                OutputStream output = socket.getOutputStream();
                String headers = "HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Type: " + mime(path)
                    + "\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\n\r\n";
                output.write(headers.getBytes(StandardCharsets.US_ASCII));
                if (parts[0].equals("GET")) {
                    byte[] buffer = new byte[65536];
                    int size;
                    while ((size = stream.read(buffer)) != -1) output.write(buffer, 0, size);
                }
            } catch (FileNotFoundException missing) { status(socket, 404, "Not Found"); }
        } catch (Exception error) { Log.w("QuestWebXR", "Asset request failed: " + error.getMessage()); }
    }

    private static String line(BufferedReader reader) throws IOException {
        StringBuilder value = new StringBuilder();
        int ch;
        while ((ch = reader.read()) != -1) {
            if (ch == '\n') return value.toString();
            if (ch != '\r') value.append((char) ch);
            if (value.length() > 8192) throw new IOException("Header too long");
        }
        return value.length() == 0 ? null : value.toString();
    }
    private static void status(Socket socket, int code, String text) throws IOException {
        socket.getOutputStream().write(("HTTP/1.1 " + code + " " + text +
            "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
    }
    private static String mime(String path) {
        String p = path.toLowerCase(java.util.Locale.ROOT);
        if (p.endsWith(".html")) return "text/html; charset=utf-8";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript; charset=utf-8";
        if (p.endsWith(".css")) return "text/css; charset=utf-8";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".wasm")) return "application/wasm";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".ogg")) return "audio/ogg";
        if (p.endsWith(".mp3")) return "audio/mpeg";
        return "application/octet-stream";
    }
}
