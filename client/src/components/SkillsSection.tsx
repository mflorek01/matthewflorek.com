import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { skills } from "@/lib/data";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

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
            {skills.map((skill) => (
              <Card key={skill.name} className="relative">
                <Collapsible>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle>{skill.name}</CardTitle>
                      <CollapsibleTrigger className="p-2 hover:bg-muted rounded-full transition-colors">
                        <ChevronDown className="h-4 w-4" />
                      </CollapsibleTrigger>
                    </div>
                    <Progress value={skill.level} className="h-2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mt-2">{skill.desc}</CardDescription>
                    <CollapsibleContent>
                      <div className="pt-4 border-t mt-4">
                        <p className="text-sm text-muted-foreground">{skill.expand}</p>
                      </div>
                    </CollapsibleContent>
                  </CardContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
