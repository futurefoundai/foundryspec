# [ENG-04] Deep Linking & Footnote Resolution

## Intent
Enable "Zero-Question Implementation" by allowing high-level diagrams to link to low-level detailed specifications.

## Mechanism
1.  **Storage:** Footnotes are stored in `assets/<category>/footnotes/<filename>.md`.
2.  **Referencing:** Mermaid diagrams use the syntax: `click NodeID "/footnotes/<category>/<filename>.md"`.
3.  **Build Phase:**
    *   The `BuildManager` scans Mermaid content for footnote links.
    *   It verifies the source file exists (Path Integrity Check).
    *   It copies all files from the source `footnotes/` dir to a flattened `dist/footnotes/<category>/` structure.
4.  **Serving:** The generated HTML viewer resolves these links to show a side-by-side or modal view of the markdown.

## Implementation Notes
*   Ensure that file paths in the `click` command are relative to the site root (starting with `/footnotes/`).
