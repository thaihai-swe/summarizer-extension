# Firefox Development and XPI Guide

DeepDigest uses a separate Firefox Manifest V3 package. Chrome loads the repository root,
while Firefox must load the generated package because Firefox uses `background.scripts` and
`sidebar_action` instead of Chrome's service worker and Side Panel API.

## Prerequisites

- Firefox 121 or newer
- Node.js 18 or newer
- The `zip` command available on your PATH (macOS and most Linux installations already have it)

Check the tools from the repository root:

```bash
node --version
zip -v
```

## Build the Firefox package

From the repository root, run:

```bash
node scripts/prepare-firefox.mjs
```

The script copies the Firefox runtime files, converts `manifest.firefox.json` to the package
root as `manifest.json`, and creates both outputs:

```text
firefox-output/firefox/                         # unpacked Firefox extension
firefox-output/deepdigest-firefox-<version>.xpi # XPI archive
```

The XPI version comes from `manifest.firefox.json`.

## Run the unpacked extension

1. Run the build command above.
2. Open `about:debugging#/runtime/this-firefox` in Firefox.
3. Select **This Firefox**.
4. Click **Load Temporary Add-on**.
5. Select `firefox-output/firefox/manifest.json`.
6. Click the DeepDigest toolbar icon to open the native Firefox sidebar.
7. Open Settings from the sidebar and configure Gemini, OpenAI, or a local provider.

Do not load the repository root directly in Firefox. Its root `manifest.json` is the Chrome
package and declares Chrome's `sidePanel` permission.

## Run the XPI

The generated XPI is unsigned and intended for temporary development testing:

1. Run `node scripts/prepare-firefox.mjs`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on**.
4. Select `firefox-output/deepdigest-firefox-<version>.xpi`.

For a normal Firefox release installation, submit the add-on through Mozilla's signing and
distribution process.

## Reload after changes

After changing source files, rebuild the package:

```bash
node scripts/prepare-firefox.mjs
```

Then use **Reload** for the temporary add-on in `about:debugging`. Rebuild the XPI whenever
you load the archive rather than the unpacked directory.

## Debugging and validation

- Extension background errors: open `about:debugging`, find DeepDigest, and click **Inspect**.
- Page extraction errors: open Firefox Web Developer Tools for the target page.
- Sidebar errors: open the sidebar document's developer tools from the extension inspection page.
- Runtime checks:

  ```bash
  node --test tests/runtime-performance.test.js
  unzip -t firefox-output/deepdigest-firefox-<version>.xpi
  ```

The Firefox package uses the native sidebar; Chrome continues to use the Side Panel API.

## Publish on addons.mozilla.org (AMO)

### 1. Build the add-on upload

Run:

```bash
node scripts/prepare-firefox.mjs
```

Upload this file in the AMO **Add-on file** field:

```text
firefox-output/deepdigest-firefox-<version>.xpi
```

An XPI is a ZIP archive. The archive must contain `manifest.json` at its root; do not zip the
`firefox-output/firefox` directory as a nested parent folder. The build script already creates the
correct layout. Verify it before uploading:

```bash
unzip -l firefox-output/deepdigest-firefox-<version>.xpi | head
unzip -t firefox-output/deepdigest-firefox-<version>.xpi
```

### 2. Decide whether to submit source code

The extension ships readable, non-minified JavaScript and does not use webpack, Babel, or a
bundler. If AMO lets you answer the source-code question, select **No** unless you introduce a
build step that transforms or bundles the code.

If AMO asks for source code, upload a separate source archive—not the generated XPI. The source
archive should include:

- `manifest.firefox.json`
- all source files under `lib/`, plus `background.js`, `content.js`, `sidepanel*`, and `options*`
- `scripts/prepare-firefox.mjs`
- `README.md` and `docs/FIREFOX.md` with the build instructions
- the `icons/` directory

Do not include `.git/`, `firefox-output/`, API keys, provider credentials, or other local secrets. A
source archive can be made from the repository after committing the source changes:

```bash
git archive --format=zip --output="firefox-output/deepdigest-firefox-source-<version>.zip" HEAD
```

If there are local source changes that are not committed yet, include those files in a separate
source ZIP instead of using `git archive`.

### 3. Submit the version

1. Sign in at [addons.mozilla.org](https://addons.mozilla.org/).
2. Open **Developer Hub** and choose **Submit a New Add-on**.
3. Choose whether to list the add-on on AMO or distribute it privately.
4. Upload the generated XPI and wait for automated validation.
5. Select Firefox as the target platform.
6. Answer the source-code question and upload the source archive only if required.
7. Complete the listing details, including support contact, license, screenshots, and category.
8. Provide a privacy-policy URL if the listing asks for one.
9. Submit the version for signing/review.

DeepDigest sends extracted page content to the provider selected by the user. The listing and
privacy policy should explain that behavior, distinguish remote providers from local endpoints,
and describe how API keys are used. The Firefox manifest already declares the required
`websiteContent` data-collection category.

AMO accepts `.xpi` or `.zip` add-on uploads, but the resulting package must be signed before it
can be installed normally in Firefox release or beta builds. The locally generated XPI is for
temporary testing until AMO signs it.

### 4. Publish updates

For every release:

1. Update the version in both `manifest.json` and `manifest.firefox.json`.
2. Run `node scripts/prepare-firefox.mjs`.
3. Upload the new `firefox-output/deepdigest-firefox-<version>.xpi` from the existing AMO add-on page.
4. Provide matching source code again if AMO requires source submission for that version.
