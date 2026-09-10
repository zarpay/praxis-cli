# site/ — the documentation site

VitePress, self-contained, published to
[zarpay.github.io/praxis-cli](https://zarpay.github.io/praxis-cli/):

```bash
npm install
npm run dev     # local preview
npm run build   # what CI publishes
```

Docs are part of a feature's definition of done: pages update in the
same milestone branch as the code (root `CLAUDE.md`). The running
example throughout is **Scoop Society** (`demo/`) — one consistent
project, told from the user's seat; nav lives in `.vitepress/config.ts`.
