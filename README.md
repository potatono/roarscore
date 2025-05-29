# RoarScore POC

This is the proof of concept project for Vy.Vision RoarScore. This web application demonstrates an audience video with a heatmap overlay, a context video (if available), a score-over-time graph synchronized with the video, a radar chart of 10 emotions, and an example of a fan view for video scoreboards. Videos are selected using the `Scene` dropdown, and scoring profiles can be selected via the `Profile` dropdown.

Autenticated users can edit scenes and profiles.  Authentication is username/password based, and user creation is handled in the Firebase console.  

Data is stored in the same Firebase Firestore instance as `roarscore-web` but utilizes separate collections.

While this repo does include backend service processing code, it is not utilized and has been superseeded by the `roarscore-service` project.  When an audience video is uploaded to a scene the `roarscore-service` project processes it like it would any other job.  

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
