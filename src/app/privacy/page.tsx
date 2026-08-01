import { TrackingPreference } from '@/components/analytics/TrackingPreference';

export const metadata = {
  title: 'Privacy and analytics'
};

export default function PrivacyPage() {
  return (
    <main>
      <h1>Privacy and analytics</h1>
      <p>This site is designed to show a portfolio without identifying visitors. Analytics is optional and is configured by the site owner in one of three modes: off, privacy-first cookieless, or consent-required.</p>
      <h2>What is measured</h2>
      <p>If anonymous analytics is enabled, the site may collect page and tab views, project and link interactions, resume-download counts, approximate referrer and campaign information, broad device/browser information, and coarse geographic information such as country or region.</p>
      <p>The site does not send chat messages, names, email addresses, resume text, or other free-form visitor input to analytics.</p>
      <h2>How it works</h2>
      <p>In privacy-first cookieless mode, the tracker may start after the page becomes interactive unless you opt out. In consent-required mode, the tracker and analytics events remain off until you explicitly opt in. The site does not use a custom persistent visitor cookie, fingerprinting, cross-site identity stitching, or sale of personal information. Returning-visitor numbers are therefore approximate and may not recognize a person across browsers, devices, networks, or privacy settings.</p>
      <p>Analytics retention is currently a manual policy, not an automated deletion process. The operator must review Umami at least quarterly and record the review; the target is to remove raw records older than approximately 12 months and aggregate reporting older than approximately 24 months when the configured Umami controls support that distinction. Until each review is completed, retention may be longer. City-level reporting is not enabled at launch.</p>
      <h2>Your preference</h2>
      <p>This preference is stored locally in your browser. It is not sent to the site and does not identify you. Changing it does not send a preference event to analytics.</p>
      <TrackingPreference />
    </main>
  );
}
