import type { Metadata } from "next";
import { PublicPage } from "@/components/public-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Coffee Sphut",
  description:
    "Privacy policy for the Coffee Sphut mobile application and services.",
};

export default function Privacy() {
  return (
    <PublicPage
      layout="document"
      eyebrow="Your privacy"
      title="Privacy policy."
      description="Information about how Coffee Sphut handles your data."
    >
      <nav
        aria-label="Privacy policy sections"
        className="mb-10 grid gap-x-6 border-b border-border pb-8 sm:grid-cols-2"
      >
        <a
          href="#information-collection-and-use"
          className="min-h-11 content-center text-sm text-primary underline-offset-4 hover:underline"
        >
          Information Collection and Use
        </a>
        <a
          href="#third-party-access"
          className="min-h-11 content-center text-sm text-primary underline-offset-4 hover:underline"
        >
          Third Party Access
        </a>
        <a
          href="#opt-out-rights"
          className="min-h-11 content-center text-sm text-primary underline-offset-4 hover:underline"
        >
          Opt-Out Rights
        </a>
        <a
          href="#data-retention-policy"
          className="min-h-11 content-center text-sm text-primary underline-offset-4 hover:underline"
        >
          Data Retention Policy
        </a>
        <a
          href="#children"
          className="min-h-11 content-center text-sm text-primary underline-offset-4 hover:underline"
        >
          Children
        </a>
        <a
          href="#security"
          className="min-h-11 content-center text-sm text-primary underline-offset-4 hover:underline"
        >
          Security
        </a>
        <a
          href="#changes"
          className="min-h-11 content-center text-sm text-primary underline-offset-4 hover:underline"
        >
          Changes
        </a>
        <a
          href="#your-consent"
          className="min-h-11 content-center text-sm text-primary underline-offset-4 hover:underline"
        >
          Your Consent
        </a>
        <a
          href="#contact-us"
          className="min-h-11 content-center text-sm text-primary underline-offset-4 hover:underline"
        >
          Contact Us
        </a>
      </nav>
      <article className="space-y-6 text-sm leading-relaxed text-foreground sm:text-base [&_h2]:scroll-mt-24 [&_h2]:pt-5 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-normal [&_h2]:tracking-tight [&_div]:space-y-6 [&_a]:break-words [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4">
        <p>
          This privacy policy applies to the Coffee Sphut app (hereby referred
          to as &quot;Application&quot;) for mobile devices that was created by
          Coffee Sphut (hereby referred to as &quot;Service Provider&quot;) as
          an Ad Supported service. This service is intended for use &quot;AS
          IS&quot;.
        </p>

        <h2 id="information-collection-and-use">
          Information Collection and Use
        </h2>
        <p>
          The Application collects information when you download and use it.
          This information may include information such as
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Your device&apos;s Internet Protocol address (e.g. IP address)
          </li>
          <li>
            The pages of the Application that you visit, the time and date of
            your visit, the time spent on those pages
          </li>
          <li>The time spent on the Application</li>
          <li>The operating system you use on your mobile device</li>
        </ul>

        <div>
          <p>
            The Application collects your device&apos;s location, which helps
            the Service Provider determine your approximate geographical
            location and make use of in below ways:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              Geolocation Services: The Service Provider utilizes location data
              to provide features such as personalized content, relevant
              recommendations, and location-based services.
            </li>
            <li>
              Analytics and Improvements: Aggregated and anonymized location
              data helps the Service Provider to analyze user behavior, identify
              trends, and improve the overall performance and functionality of
              the Application.
            </li>
            <li>
              Third-Party Services: Periodically, the Service Provider may
              transmit anonymized location data to external services. These
              services assist them in enhancing the Application and optimizing
              their offerings.
            </li>
          </ul>
        </div>

        <p>
          The Application does not use Artificial Intelligence (AI) technologies
          to process your data or provide features.
        </p>

        <p>
          The Service Provider may use the information you provided to contact
          you from time to time to provide you with important information,
          required notices and marketing promotions.
        </p>

        <p>
          For a better experience, while using the Application, the Service
          Provider may require you to provide us with certain personally
          identifiable information, including but not limited to Email, First
          Name, Last Name, Phone Number, Birthday, Address. The information that
          the Service Provider request will be retained by them and used as
          described in this privacy policy.
        </p>

        <h2 id="third-party-access">Third Party Access</h2>
        <p>
          Only aggregated, anonymized data is periodically transmitted to
          external services to aid the Service Provider in improving the
          Application and their service. The Service Provider may share your
          information with third parties in the ways that are described in this
          privacy statement.
        </p>
        <div>
          <p>
            Please note that the Application utilizes third-party services that
            have their own Privacy Policy about handling data. Below are the
            links to the Privacy Policy of the third-party service providers
            used by the Application:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <a
                href="https://support.google.com/admob/answer/6128543?hl=en"
                target="_blank"
                rel="noopener noreferrer"
              >
                AdMob
              </a>
            </li>
            <li>
              <a
                href="https://www.mapbox.com/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Mapbox
              </a>
            </li>
            <li>
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Supabase
              </a>
            </li>
            <li>
              <a
                href="https://www.sanity.io/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                SanityIO
              </a>
            </li>
          </ul>
        </div>

        <p>
          The Service Provider may disclose User Provided and Automatically
          Collected Information:
        </p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            as required by law, such as to comply with a subpoena, or similar
            legal process;
          </li>
          <li>
            when they believe in good faith that disclosure is necessary to
            protect their rights, protect your safety or the safety of others,
            investigate fraud, or respond to a government request;
          </li>
          <li>
            with their trusted services providers who work on their behalf, do
            not have an independent use of the information we disclose to them,
            and have agreed to adhere to the rules set forth in this privacy
            statement.
          </li>
        </ul>

        <h2 id="opt-out-rights">Opt-Out Rights</h2>
        <p>
          You can stop all collection of information by the Application easily
          by uninstalling it. You may use the standard uninstall processes as
          may be available as part of your mobile device or via the mobile
          application marketplace or network.
        </p>

        <h2 id="data-retention-policy">Data Retention Policy</h2>
        <p>
          The Service Provider will retain User Provided data for as long as you
          use the Application. If you&apos;d like them to delete User Provided
          Data that you have provided via the Application, please contact them
          at info@coffeesphut.com and they will respond in a reasonable time.
        </p>

        <h2 id="children">Children</h2>
        <p>
          The Service Provider does not use the Application to knowingly solicit
          data from or market to children under the age of 13.
        </p>
        <div>
          <p>
            The Application does not address anyone under the age of 13. The
            Service Provider does not knowingly collect personally identifiable
            information from children under 13 years of age. In the case the
            Service Provider discover that a child under 13 has provided
            personal information, the Service Provider will immediately delete
            this from their servers. If you are a parent or guardian and you are
            aware that your child has provided us with personal information,
            please contact the Service Provider (info@coffeesphut.com) so that
            they will be able to take the necessary actions.
          </p>
        </div>

        <h2 id="security">Security</h2>
        <p>
          The Service Provider is concerned about safeguarding the
          confidentiality of your information. The Service Provider provides
          physical, electronic, and procedural safeguards to protect information
          the Service Provider processes and maintains.
        </p>

        <h2 id="changes">Changes</h2>
        <p>
          This Privacy Policy may be updated from time to time for any reason.
          The Service Provider will notify you of any changes to the Privacy
          Policy by updating this page with the new Privacy Policy. You are
          advised to consult this Privacy Policy regularly for any changes, as
          continued use is deemed approval of all changes.
        </p>

        <p>This privacy policy is effective as of 2026-03-30</p>

        <h2 id="your-consent">Your Consent</h2>
        <p>
          By using the Application, you are consenting to the processing of your
          information as set forth in this Privacy Policy now and as amended by
          us.
        </p>

        <h2 id="contact-us">Contact Us</h2>
        <p>
          If you have any questions regarding privacy while using the
          Application, or have questions about the practices, please contact the
          Service Provider via email at info@coffeesphut.com.
        </p>
      </article>
    </PublicPage>
  );
}
