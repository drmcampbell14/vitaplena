# Vita Plena — store listing

Copy for App Store Connect and the Google Play Console. Paste as written; the
character limits are Apple's. Screenshots are in `store/screenshots/` (made by
`scripts/store-shots.mjs` from the sample household).

## Names

| Field | Value | Limit |
|---|---|---|
| Name | Vita Plena | 30 |
| Subtitle (Apple) / Short description (Google) | A Catholic household's rule of life | 30 / 80 |
| Bundle id / package | com.cognitivechristian.vitaplena | fixed after first upload |
| SKU (Apple, internal) | vitaplena-ios | |
| Primary category | Lifestyle | |
| Secondary category | Productivity | |
| Age rating | 4+ (no objectionable content; "unrestricted web access" No) | |
| Copyright | © 2026 Cognitive Christian | |
| Support URL | https://vitaplena13.netlify.app/support.html | |
| Marketing URL | https://vitaplena13.netlify.app | |
| Privacy Policy URL | https://vitaplena13.netlify.app/privacy.html | |
| Terms (EULA) | Apple's standard EULA; link to https://vitaplena13.netlify.app/terms.html in the description | |

When the custom domain exists, replace the three URLs everywhere (listing, `src/lib/native.js`, the plan sheet's links).

## Promotional text (Apple, 170, can change without a new build)

The house keeps the hours. One day for prayer, work, family and rest, and a bell at every hour of prayer.

## Description (Apple 4,000 · Google 4,000)

Vita Plena is a Catholic household's rule of life, kept by the house itself.

Set the hours of prayer once. The app puts the Angelus, the Rosary, the Examen and the rest of your rule into the day beside your events, your chores and your bills, and rings a bell at each hour, whether the app is open or not. Tap the bell and the prayer is on the screen.

THE DAY
• One timeline for the household: prayer, work, family, rest.
• Tasks placed into the free time between prayers and events, with travel time kept around every appointment.
• Cross things off; the rest moves down the day.

THE BELLS
• A church bell or a soft chime at each practice's hour.
• Quiet hours per device: the tablet in the kitchen rings, the phone at work does not.

PRAY
• The traditional prayer library: the Rosary with the day's mysteries, the Divine Mercy Chaplet, the Examen, the Angelus, morning and night prayer.
• Today at Mass: the day's readings from the Douay-Rheims Bible, in the app.
• The liturgical season sets the colour of the day. Feasts and fasts are marked.

THE HOUSEHOLD
• Two accounts, one household. Children and pets as people without accounts.
• Chores assigned to a person, a child, or both of you, and chores that rotate on their own.
• Bills with due dates, kept apart from tasks.
• A photo of a season's schedule becomes calendar events.
• Google Calendar sync from the website; a calendar feed for Apple Calendar and Outlook.

US
• The weekly check-in and the monthly sit-down, with questions worth asking each other.
• Three words: please, thank you, sorry.
• A virtue for the month.

BEACON
• Say it plainly: "rosary at 8, vacuum Tuesdays, dentist Friday at 2." Beacon puts it in the right place.
• Every Sunday, a short briefing for the week ahead.

Tradition speaks; the evidence is the footnote. The prayers are the Church's own. The Bible text is the Douay-Rheims (Challoner), in the public domain.

A household starts with thirty days free. Afterwards the rule of life, the calendar, the prayers and the bells keep working; the family plan keeps Beacon and the Sunday briefing going. One plan covers every member of the household. Subscriptions renew automatically unless cancelled at least 24 hours before the period ends, and can be managed in your account settings.

Terms: https://vitaplena13.netlify.app/terms.html
Privacy: https://vitaplena13.netlify.app/privacy.html

## Keywords (Apple, 100 characters, comma-separated, no spaces after commas)

catholic,rosary,prayer,liturgy,family,household,chores,angelus,examen,mass readings,rule of life

## What's new (first release)

The first release: the rule of life, the bells, the prayer library with the day's readings, the household calendar, chores that rotate, bills, the weekly check-in, and Beacon.

## Google Play extras

- Short description (80): A Catholic household's rule of life. The house keeps the hours.
- App category: Lifestyle. Tags: Catholic, prayer, family organizer.
- Content rating questionnaire: no violence, no sexual content, no user-to-user sharing outside the household, no location. Result: Everyone.
- Data safety: see the privacy answers below; "Data is encrypted in transit: Yes"; "Users can request deletion: Yes, in the app".
- Feature graphic (1024×500): the mark on the Marian field with the name. Make it from `assets/icon-foreground.png` on `#16386A` in any editor.

## App Privacy answers (App Store Connect → App Privacy)

These match `ios/App/App/PrivacyInfo.xcprivacy`. Answer "Yes, we collect data from this app", then:

| Data type | Collected | Linked to the user | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact info → Email address | Yes | Yes | No | App functionality (sign-in) |
| Contact info → Name | Yes | Yes | No | App functionality (shown to the household) |
| Identifiers → User ID | Yes | Yes | No | App functionality |
| User content → Other user content | Yes | Yes | No | App functionality (the household's practices, tasks, events, notes) |
| Purchases → Purchase history | Yes (once the plan is live) | Yes | No | App functionality |

Everything else: not collected. Tracking: No. Third parties that receive data: Google (Firebase Auth and Firestore, as a processor), Anthropic (messages to Beacon, as a processor; not used for training), RevenueCat (purchase records, once the plan is live).

## Review notes (App Store Connect → App Review Information → Notes)

> Vita Plena is a household app: two spouses share one household record.
>
> To look around without an account, tap "Look around first, with a sample household" on the sign-in screen. Everything there is in memory.
>
> To test sign-in and the household flow, use the demo account below or create a new account with any email (no verification step). Creating a household runs a four-step setup, then opens the app.
>
> Sign-in: email and password. Continue with Apple appears on iOS when enabled.
>
> Notifications are used only for the bells (an hour-of-prayer reminder the user sets). Camera and photo access are used only by "Scan a schedule" on the Calendar tab, which turns a photo of a printed schedule into calendar events.
>
> Subscription: Settings → Plan → Subscribe. Restore a purchase is on the same sheet. Account deletion is in Settings → Your data → Delete my account.

Demo account (create it before submitting; see SUBMIT.md step 9): email `reviewer@cognitivechristian.com`, password chosen at creation; household "The Review Household".
