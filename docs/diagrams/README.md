# NovelGraph diagram sources

These Mermaid files are the canonical descriptions of NovelGraph's public architecture and workflows. Generated SVG and PNG files are derived release assets. Every diagram is paired with prose in the documentation because the drawing is evidence, not a substitute for explanation.

The notation is deliberately small: rectangles are processes, cylinders are durable stores, diamonds are author or validation decisions, solid arrows are required flows, and dotted arrows are optional, external, or excluded flows. Cyan carries structure in rendered assets. Electric blue marks the path under discussion. Labels and shapes preserve meaning when color is unavailable.

| Diagram | Question answered |
| --- | --- |
| Discovery state | When may a book leave discovery? |
| Agent boundaries | What may Sol, Terra, Luna, and the author decide? |
| Knowledge layers | Which store owns literary guidance, series facts, book canon, and working memory? |
| Canon promotion | How does a conversational observation become an approved fact? |
| Charter lifecycle | What invalidates an approved charter? |
| Production DAG | How does the system move from intent to export? |
| Series linking | What happens when a book contradicts its series? |
| Reader projection | Which mystery facts remain hidden from drafting and solver agents? |
| Revision invalidation | Which audits become stale after a canon change? |
| Local architecture | Which processes and stores run on the author's machine? |
| Closure export | Why is an export blocked? |
| Legacy migration | How is an earlier local store preserved? |
| Studio routes | Where does each author task live? |
| Release pipeline | What must pass before the public release is promoted? |
