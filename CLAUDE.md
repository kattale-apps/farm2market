<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

## Keep it simple

Design every screen for the basic, semi-literate user first: few choices, presets over free text, plain words, and light data (paginated, thumbnail-only lists). Build the data model so it can expand for more comprehensive users without a redesign. Protect both the buyer and the seller in every money or contact flow.

Photo inputs always offer camera and gallery upload together (use `GeneralCameraCapture` or `PhotoSetCapture`), so a user who cannot take a picture can still upload one.
