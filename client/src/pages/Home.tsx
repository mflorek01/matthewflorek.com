import { Helmet } from "react-helmet";
import Hero from "@/components/Hero";
import SkillsSection from "@/components/SkillsSection";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Matthew Florek | Data & Financial Analyst</title>
        <meta
          name="description"
          content="Professional portfolio of Matthew Florek, specializing in data analysis and financial modeling."
        />
      </Helmet>

      <Hero />
      
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            <Card>
              <CardContent className="p-6">
                <img
                  src="https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a"
                  alt="Data analysis workspace"
                  className="rounded-lg mb-4 w-full h-48 object-cover"
                />
                <h3 className="text-xl font-semibold mb-2">Data Analysis</h3>
                <p className="text-muted-foreground">
                  Transforming raw data into meaningful insights through advanced
                  analytics and visualization techniques.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <img
                  src="https://images.unsplash.com/photo-1444653614773-995cb1ef9efa"
                  alt="Financial charts"
                  className="rounded-lg mb-4 w-full h-48 object-cover"
                />
                <h3 className="text-xl font-semibold mb-2">Financial Analysis</h3>
                <p className="text-muted-foreground">
                  Creating comprehensive financial models and reports to drive
                  strategic decision-making.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      <SkillsSection />
    </>
  );
}
