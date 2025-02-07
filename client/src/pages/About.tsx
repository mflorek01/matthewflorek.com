import { Helmet } from "react-helmet";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function About() {
  return (
    <>
      <Helmet>
        <title>About | Matthew Florek</title>
        <meta
          name="description"
          content="Learn about Matthew Florek's professional background and expertise in data and financial analysis."
        />
      </Helmet>

      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="max-w-3xl mx-auto">
              <h1 className="text-4xl font-bold mb-6">About Me</h1>
              <Card className="mb-8">
                <CardContent className="p-6">
                  <img
                    src="https://images.unsplash.com/photo-1517048676732-d65bc937f952"
                    alt="Modern office setting"
                    className="rounded-lg mb-6 w-full h-64 object-cover"
                  />
                  <p className="text-lg text-muted-foreground mb-4">
                    I am a data and financial analyst with a passion for turning
                    complex data into actionable insights. With expertise in
                    financial modeling, data visualization, and statistical
                    analysis, I help organizations make data-driven decisions.
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Education</CardTitle>
                    <CardDescription>Academic Background</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      <li>B.S. in Finance & Analytics</li>
                      <li>Data Science Certification</li>
                      <li>Financial Modeling Certificate</li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Experience</CardTitle>
                    <CardDescription>Professional Journey</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      <li>Financial Analyst at Tech Corp</li>
                      <li>Data Analyst at Finance Inc</li>
                      <li>Business Intelligence Consultant</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
