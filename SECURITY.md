# Security Policy

## Reporting a vulnerability

If you find a security problem in Bisik, please report it privately first —
don't open a public issue with the details.

Reach the maintainer through the contact page at
[ednasalam.com](https://www.ednasalam.com), and mention "Bisik security" so it
gets routed quickly. You'll get an acknowledgement, and a fix or a public
explanation as soon as one exists. Credit in the release notes is yours if
you want it.

## Scope notes

Bisik's threat model is documented in the app itself, on the
[Security page](https://bisik.ednasalam.com/security.html) — including what it
deliberately does *not* protect against (compromised devices, screenshots by
the other party, weak codes, and the current lack of forward secrecy).
Reports about those documented limits are still welcome as discussion, but
they're known design trade-offs, not vulnerabilities.

High-value reports: anything that lets a third party read message contents,
enter a room without the code, make the relay store or leak data, or break
the "messages are never stored" property.

## Supported versions

Only the latest release (the version live at bisik.ednasalam.com) is
supported. There are no backports — the app is small on purpose.
