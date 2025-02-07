import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FileText, Linkedin } from "lucide-react";

export default function Hero() {
  return (
    <div className="relative min-h-[90vh] flex items-center">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="md:col-span-2"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Data Analysis & Financial Insights
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Recent finance graduate with a strong foundation in data analysis,
              financial modeling, and a passion for transforming complex data into
              actionable insights.
            </p>
            <div className="flex gap-4">
              <a href="/Matthew Florek Resume.pdf" target="_blank" rel="noopener noreferrer">
                <Button size="lg">
                  View Resume
                  <FileText className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a href="https://linkedin.com/in/matthew-florek" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="lg">
                  LinkedIn
                  <Linkedin className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden md:block"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg transform -rotate-2" />
              <img
                src="/attached_assets/2023-03-03_FCBHeadshots-35.jpg"
                alt="Matthew Florek portrait"
                className="w-full h-[500px] object-cover rounded-lg shadow-lg transform rotate-2"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}