import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

export default function ContactSection() {
  const emailAddress = "contact@example.com"; // Replace with your actual email
  const subject = "Portfolio Contact";
  const mailtoLink = `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}`;

  return (
    <div className="text-center">
      <p className="mb-6 text-muted-foreground">
        I'd love to hear from you! Click below to send me an email directly.
      </p>
      <a href={mailtoLink}>
        <Button className="w-full" size="lg">
          <Mail className="mr-2 h-4 w-4" />
          Send Email
        </Button>
      </a>
    </div>
  );
}