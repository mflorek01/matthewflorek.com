import { Helmet } from "react-helmet";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Linkedin, Github } from "lucide-react";
import ContactSection from "@/components/ContactForm";

export default function Contact() {
  const contactEmail = "contact@example.com"; // Replace with your actual email

  return (
    <>
      <Helmet>
        <title>Contact | Matthew Florek</title>
        <meta
          name="description"
          content="Get in touch with Matthew Florek for data analysis and financial modeling opportunities."
        />
      </Helmet>

      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto"
          >
            <h1 className="text-4xl font-bold mb-8">Get in Touch</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardContent className="p-4 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <a href={`mailto:${contactEmail}`} className="text-sm hover:text-primary">
                    {contactEmail}
                  </a>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-2">
                  <Linkedin className="h-4 w-4" />
                  <a 
                    href="https://linkedin.com/in/matthew"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:text-primary"
                  >
                    linkedin.com/in/matthew
                  </a>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  <a 
                    href="https://github.com/matthew"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:text-primary"
                  >
                    github.com/matthew
                  </a>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-6">
                <ContactSection />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </>
  );
}