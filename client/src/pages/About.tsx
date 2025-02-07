import { Helmet } from "react-helmet";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { education, experience } from "@/lib/data";

export default function About() {
  return (
    <>
      <Helmet>
        <title>About | Matthew Florek</title>
        <meta
          name="description"
          content="Learn about Matthew Florek's academic background and experience in data and financial analysis."
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
                  <p className="text-lg text-muted-foreground mb-4">
                    As a recent graduate with a strong foundation in finance and data analytics,
                    I am passionate about leveraging data to drive business decisions. My
                    academic journey has equipped me with the technical skills and analytical
                    mindset needed to tackle complex financial challenges.
                  </p>
                  <p className="text-lg text-muted-foreground">
                    Through my coursework and projects, I've developed expertise in financial
                    modeling, data visualization, and statistical analysis. I'm particularly
                    interested in how data analytics can be applied to financial decision-making
                    and market analysis.
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Education</CardTitle>
                    <CardDescription>Academic Background</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {education.map((edu) => (
                      <div key={edu.degree} className="mb-4">
                        <h3 className="font-semibold">{edu.degree}</h3>
                        <p className="text-sm text-muted-foreground">
                          {edu.institution} • {edu.year}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Experience & Projects</CardTitle>
                    <CardDescription>Academic and Professional Experience</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {experience.map((exp) => (
                      <div key={exp.title} className="mb-4">
                        <h3 className="font-semibold">{exp.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {exp.company} • {exp.duration}
                        </p>
                        <p className="mt-1 text-sm">{exp.description}</p>
                      </div>
                    ))}
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