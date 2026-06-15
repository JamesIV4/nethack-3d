export type Nh3dVersionTag = {
  name: string;
  version: string;
  releaseNotesMarkdown?: string | null;
  releasePageUrl?: string | null;
};

export type Nh3dVersionCheckResult = {
  currentVersion: string;
  latestTagName: string | null;
  latestVersion: string | null;
  hasUpdate: boolean;
  newerTags: Nh3dVersionTag[];
  releasesPageUrl: string;
  error: string | null;
};
