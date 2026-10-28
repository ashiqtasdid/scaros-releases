# ScarOS downloads

Public update packages, release signatures and the desktop design preview.
The development repository is separate and private.

- Website: https://ashiqtasdid.github.io/scaros-releases/
- Packages: https://github.com/ashiqtasdid/scaros-releases/releases
- Stable repository: `https://github.com/ashiqtasdid/scaros-releases/releases/latest/download`

ScarOS is experimental. A keyring/bootstrap release configures update delivery;
it does not replace the desktop or certify a new installation image.

## Verify the release key

The pinned fingerprint is recorded in `channel.json`. Verify it against the
trusted installation media or development repository before trusting a key.
Only the public key is hosted here. Private signing keys and passwords are never
part of this repository, its website or its workflows.

## Updates

New matching installation media includes `scaros-keyring`, which configures the
signed repository. Installed systems use **Settings → Software Updates** or
`sudo pacman -Syu`. A source commit alone does not publish an OS update.

This repository uses GitHub Pages and Release assets. It has no paid runner,
Git LFS storage, GitHub Packages dependency or custom-domain requirement.
