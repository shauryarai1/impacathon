import { useEffect } from "react";
import {
  ArrowRight,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const steps = [
  {
    number: "01",
    title: "Request help",
    copy: "Residents report what they need and where.",
  },
  {
    number: "02",
    title: "Coordinate relief",
    copy: "Verified needs are matched with available resources, with human approval.",
  },
  {
    number: "03",
    title: "Deliver support",
    copy: "Volunteers track deliveries and confirm that help arrives.",
  },
];

export default function Landing() {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        window.setTimeout(
          () => target.scrollIntoView({ behavior: "smooth", block: "start" }),
          0,
        );
        return;
      }
    }
    window.scrollTo({ top: 0 });
  }, [hash]);

  return (
    <div className="landing-page landing-page--premium">
      <section className="landing-hero landing-hero--simple">
        <div className="landing-hero__copy">
          <p className="eyebrow eyebrow--signal">
            <span className="eyebrow-line" /> Community relief, reimagined
          </p>
          <h1>
            When systems fail,
            <br />
            <em>communities connect.</em>
          </h1>
          <p className="landing-hero__lead">
            One simple platform to request help, coordinate resources, and
            deliver relief when every minute matters.
          </p>
          <div className="landing-actions">
            <Link
              className="button button--primary button--lg"
              to="/request-help"
            >
              Request Help <ArrowRight size={17} />
            </Link>
            <a className="text-link landing-secondary-link" href="#how-it-works">
              See how it works <ChevronDown size={14} />
            </a>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="landing-section">
        <div className="landing-section__head">
          <p className="eyebrow eyebrow--signal">How it works</p>
          <h2>From a request to relief, with people in the loop.</h2>
        </div>
        <div className="landing-steps">
          {steps.map((step) => (
            <div className="landing-step" key={step.number}>
              <span className="landing-step__number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="about" className="landing-trust">
        <div>
          <p className="eyebrow eyebrow--signal">Trust by design</p>
          <h2>Technology recommends. People decide.</h2>
        </div>
        <div className="landing-trust__copy">
          <p>
            Every resource allocation requires explicit coordinator approval.
            LIFELINE surfaces verified needs, available supply, and route
            conditions, but a person makes the decision to reserve and deliver.
          </p>
          <p>
            LIFELINE is an independent community coordination tool. It does not
            replace emergency services and does not claim endorsement by any
            government agency or emergency service.
          </p>
          <div className="landing-trust__note">
            <ShieldCheck size={16} />
            <span>Human approval is required before stock is reserved or a delivery is created.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
