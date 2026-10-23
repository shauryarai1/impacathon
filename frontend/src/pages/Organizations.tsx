import { ArrowLeft, ArrowRight, Building2, Check, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, Surface } from "../components/UI";

export default function Organizations() {
  return (
    <div className="org-page">
      <Link className="back-link" to="/">
        <ArrowLeft size={15} /> Back to LIFELINE
      </Link>
      <div className="org-intro">
        <p className="eyebrow eyebrow--signal">For organizations</p>
        <h1>Keep emergency help free for the people who need it.</h1>
        <p>
          LIFELINE is free for residents and volunteers. NGOs and municipalities
          can license the coordination layer that helps their teams verify
          needs, approve resources, and keep deliveries visible.
        </p>
      </div>
      <div className="org-grid">
        <Surface>
          <Building2 size={19} />
          <h2>Built for response teams</h2>
          <p>
            One calm operating picture for organizations coordinating across
            neighborhoods, shelters, clinics, and suppliers.
          </p>
          <ul>
            <li>
              <Check size={14} /> Free for residents requesting help
            </li>
            <li>
              <Check size={14} /> Free for volunteers delivering relief
            </li>
            <li>
              <Check size={14} /> Human approval stays central
            </li>
          </ul>
        </Surface>
        <Surface>
          <p className="eyebrow">Proposed future services</p>
          <h2>Support that scales with the mission.</h2>
          <p>
            Potential paid organizational services could include multi-team
            coordination, custom onboarding, operational reports, training,
            managed hosting, and deployment support.
          </p>
          <p className="org-note">
            These are proposed services, not features currently implemented.
            Optional paid pilots and annual organization licenses can support
            sustainability.
          </p>
        </Surface>
      </div>
      <div className="org-cta">
        <div>
          <p className="eyebrow">Partner with us</p>
          <h2>Help shape a more resilient response layer.</h2>
          <p>
            There is no contact endpoint in this preview. Use the email
            placeholder to start a conversation.
          </p>
        </div>
        <a
          className="button button--primary"
          href="mailto:partnerships@lifeline.example?subject=LIFELINE%20organization%20pilot"
        >
          <Mail size={15} /> Partner with us <ArrowRight size={15} />
        </a>
      </div>
      <p className="org-footnote">
        No payment gateway, subscription checkout, ads, donations, or resident
        charges are part of LIFELINE.
      </p>
    </div>
  );
}
