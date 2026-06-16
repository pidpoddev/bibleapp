# Toolbar Icon Spec (Studio)

Use this format for all Studio toolbar icons (`Text`, `Decor`, `Canvas`, `Note`, `More`):

- File type: `PNG`
- Size: `350 x 350 px`
- Background: `transparent`
- One icon per file (do not use a sprite sheet)
- Icon artwork should be centered

## File Mapping

- `assets/images/toolbar-icons/text-tight.png`
- `assets/images/toolbar-icons/decor-tight.png`
- `assets/images/toolbar-icons/canvas-tight.png`
- `assets/images/toolbar-icons/notes-tight.png`
- `assets/images/toolbar-icons/more-tight.png`

## Update Workflow

1. Export each icon as a separate `350x350` transparent PNG.
2. Replace the matching file in `assets/images/toolbar-icons/`.
3. Commit and push to `main`.
4. Publish an Expo update to `production`.
