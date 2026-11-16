# Android Firebase configuration

Download the Android `google-services.json` for `com.k45movies.app` from the
Firebase project settings. Place it in the repository root for local builds.
To use a different path, copy `.env.example` to `.env.local` and set
`GOOGLE_SERVICES_JSON` there. Keep the Firebase file outside Git.

For EAS Android builds, set `GOOGLE_SERVICES_JSON` as a **Secret** file variable
on the EAS project for the `development`, `preview`, and `production`
environments. Upload the Firebase file as the value. In the build job, EAS
sets the variable to the uploaded file's path.

When rotating the Firebase API key, replace the local file and the EAS file
variable, test the updated Android build, and then retire the old key after
accounting for installed builds that still use it.
