import packageInfo from "../../package.json";
import { useState } from "react";
import { RefreshCw, Download, CircleCheck, Github } from "lucide-react";
import { z } from "zod";
import { Panel } from "../components/ui";
import { compareVersions } from "../lib/model";
import { installed } from "../lib/browser";
import type { FeatureProps } from "./types";
const releaseSchema = z.object({
  tag_name: z.string().regex(/^v?\d+\.\d+\.\d+$/),
  html_url: z
    .string()
    .url()
    .refine((v) =>
      v.startsWith("https://github.com/Arnav-Dugad/Aether/releases/"),
    ),
  body: z.string().nullable(),
  published_at: z.string(),
  prerelease: z.boolean(),
  assets: z.array(
    z.object({
      name: z.string(),
      browser_download_url: z
        .string()
        .url()
        .refine((v) =>
          v.startsWith(
            "https://github.com/Arnav-Dugad/Aether/releases/download/",
          ),
        ),
    }),
  ),
});
export function Updates({ run }: FeatureProps) {
  const [state, setState] = useState("Ready to check");
  const [release, setRelease] = useState<z.infer<typeof releaseSchema> | null>(
    null,
  );
  const [checked, setChecked] = useState("");
  const current = installed
    ? chrome.runtime.getManifest().version
    : packageInfo.version;
  async function check() {
    if (!installed) throw new Error("Install Aether to check releases.");
    const permitted =
      (await chrome.permissions.contains({
        origins: ["https://api.github.com/*"],
      })) ||
      (await chrome.permissions.request({
        origins: ["https://api.github.com/*"],
      }));
    if (!permitted) throw new Error("GitHub access was not granted.");
    setState("Checking…");
    try {
      const response = await fetch(
        "https://api.github.com/repos/Arnav-Dugad/Aether/releases/latest",
        {
          headers: { Accept: "application/vnd.github+json" },
          signal: AbortSignal.timeout(15000),
        },
      );
      if (response.status === 404) {
        setState("No stable release has been published yet");
        setChecked(new Date().toLocaleString());
        return;
      }
      if (!response.ok)
        throw new Error(
          response.status === 403
            ? "GitHub rate limit reached. Try later."
            : `GitHub returned ${response.status}`,
        );
      const value = releaseSchema.parse(await response.json());
      setRelease(value);
      setState(
        compareVersions(value.tag_name, current) > 0
          ? "New version available"
          : "You’re up to date",
      );
      setChecked(new Date().toLocaleString());
    } catch (e) {
      setState("Check failed");
      throw e;
    }
  }
  return (
    <>
      <Panel className="update-hero">
        <div className="update-icon">
          <CircleCheck size={34} />
        </div>
        <span className="eyebrow">AETHER {current}</span>
        <h2>{state}</h2>
        <p className="muted">
          Release discovery connects to the official public GitHub repository
          only when you ask.
        </p>
        <button
          className="primary"
          disabled={state === "Checking…"}
          onClick={() => run(check)}
        >
          <RefreshCw size={16} />
          Check for updates
        </button>
        {checked && (
          <small className="muted">Last successful check: {checked}</small>
        )}
      </Panel>
      {release && (
        <Panel
          title={`Release ${release.tag_name}`}
          label={new Date(release.published_at).toLocaleDateString()}
        >
          <p className="release-notes">
            {release.body || "No release notes provided."}
          </p>
          <div className="button-row">
            <a
              className="secondary"
              href={release.html_url}
              target="_blank"
              rel="noreferrer"
            >
              <Github size={16} />
              View release
            </a>
            {release.assets
              .filter((asset) => asset.name.endsWith(".zip"))
              .map((asset) => (
                <a
                  key={asset.name}
                  className="secondary"
                  href={asset.browser_download_url}
                >
                  <Download size={16} />
                  {asset.name}
                </a>
              ))}
          </div>
        </Panel>
      )}
      <Panel title="A clear update path">
        <p className="muted">
          For an unpacked installation, download the release ZIP, extract it
          into your existing extension folder, then choose Reload in your
          browser’s extensions page. Keep the same folder path to preserve the
          extension identity and local data.
        </p>
        <p className="caption">
          Downloading a package does not install it. Store installations, if
          published in the future, use browser-managed updates.
        </p>
      </Panel>
    </>
  );
}
