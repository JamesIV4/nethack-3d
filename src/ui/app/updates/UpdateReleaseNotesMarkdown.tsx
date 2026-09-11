import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Release-note markdown component. */
export function UpdateReleaseNotesMarkdown({
  markdown,
}: {
  markdown: string;
}): JSX.Element {
  return (
    <div className="nh3d-startup-update-release-notes">
      <ReactMarkdown
        components={{
          a: ({ ...props }) => (
            <a {...props} rel="noreferrer" target="_blank" />
          ),
        }}
        remarkPlugins={[remarkGfm]}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
