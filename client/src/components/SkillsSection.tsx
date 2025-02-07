import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const skills = [
  { name: "Data Analysis", level: 90 },
  { name: "Financial Modeling", level: 85 },
  { name: "SQL", level: 88 },
  { name: "Python", level: 82 },
  { name: "Excel/VBA", level: 95 },
  { name: "Power BI", level: 87 },
];

export default function SkillsSection() {
  return (
    <section className="py-16 bg-muted/50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl font-bold mb-8">Technical Skills</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {skills.map((skill, index) => (
              <Card key={skill.name}>
                <CardHeader>
                  <CardTitle>{skill.name}</CardTitle>
                  <CardDescription>Professional Proficiency</CardDescription>
                </CardHeader>
                <CardContent>
                  <Progress value={skill.level} className="h-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
