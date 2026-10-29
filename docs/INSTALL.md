# Download and test a ScarOS VM image

ScarOS is experimental. These images support UEFI virtual-machine evaluation;
physical installation is disabled. Use a new virtual disk and never attach a
host drive. The desktop preview website is a simulation.

## Download

Open [ScarOS Releases](https://github.com/ashiqtasdid/scaros-releases/releases)
and choose an **iso-v…-testing** image prerelease. Download every file from that
release into one folder:

If no such prerelease is listed, installation media has not been published yet.

- Every `.iso.part001`, `.iso.part002`, … file.
- `image.json` and `image.json.sig`.
- `scaros-image.py` and `scaros-image.py.sig`.
- `release-key.asc`.

Each part is at most 1 GiB. Have at least 12 GiB free for the downloaded parts
and the assembled ISO. Do not mix files from different releases. Image
prereleases are separate from the stable signed package repository.

## Authenticate before executing downloaded code

You need Python 3.11 or newer and GnuPG. Git for Windows includes GnuPG; the
assembler detects it even when it is not on PATH.

The release key fingerprint is:

**`0D88CA052EE7677DEAD049AEC0F5DF33037D1BF5`**

Confirm this through trusted project information, independently of an unknown
download mirror. A downloaded public key alone does not establish trust.

On Linux, from the download folder:

```sh
gpg --show-keys --fingerprint release-key.asc
# Compare the full fingerprint above before importing.
gpg --import release-key.asc
gpg --verify scaros-image.py.sig scaros-image.py
```

On Windows PowerShell with Git for Windows:

```powershell
$gpg = "$env:ProgramFiles\Git\usr\bin\gpg.exe"
& $gpg --show-keys --fingerprint ./release-key.asc
# Compare the full fingerprint above before importing.
& $gpg --import ./release-key.asc
& $gpg --verify ./scaros-image.py.sig ./scaros-image.py
```

Stop if the fingerprint or signature is wrong. Only after verifying the tool,
run:

```sh
python scaros-image.py assemble . --output ScarOS.iso --public-key release-key.asc
```

The tool authenticates the manifest against its pinned key in an isolated
temporary keyring, checks every chunk and verifies the complete ISO hash. The
final ISO name appears only after all checks pass. Existing output files are
preserved. A failed attempt does not leave a final-looking partial ISO.

## VMware installation

Create a new Linux VM with UEFI, Secure Boot off, 4 vCPUs, 8 GiB RAM, a blank
64 GiB or larger virtual disk, NAT and 3D acceleration. The development QA
fixture also runs at 4 GiB RAM. Attach `ScarOS.iso` as its virtual CD/DVD.

Boot the live desktop, open **Install ScarOS**, choose the new virtual disk,
select profiles/apps and create your own local account. Review the disk
identity before entering the exact erase phrase. After installation completes,
shut down, disconnect the ISO and boot the installed virtual disk. Sign in with
the account you created; installed systems do not use live autologin.

The fallback-driver boot entry uses a broader initramfs. It is not an earlier
kernel or automatic OS rollback. Physical GPUs, real Windows dual boot,
recovery/rollback, full app compatibility and frame pacing remain separate
acceptance work.
