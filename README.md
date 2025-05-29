# RoarScore POC

This is the proof of concept project for Vy.Vision RoarScore.

# Dependencies

* Firebase
    * Auth (username/password)
    * Firebase
    * Storage
    * Hosting
* Cloudflared

# Envrionment

Local development uses an Express server to emulate firebase functions.  The
development instance on `magicmissile` is using cloudflared to map to
`poc.roarscore.ai`.

Deployment to production hosting is superseeded by the `roarscore-web` project, 
do not deploy to production without reviewing the firebase settings.




