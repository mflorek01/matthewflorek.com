import { Helmet } from "react-helmet";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const projects = [
  {
    title: "Financial Dashboard Development",
    description: "Created interactive financial dashboards using Power BI",
    image: "https://images.unsplash.com/photo-1563986768711-b3bde3dc821e",
    tags: ["Power BI", "Financial Analysis", "Dashboard Design"],
  },
  {
    title: "Market Analysis Project",
    description: "Comprehensive market analysis using Python and SQL",
    image: "https://images.unsplash.com/photo-1499750310107-5fef28a66643",
    tags: ["Python", "SQL", "Data Analysis"],
  },
];

export default function Portfolio() {
  return (
    <>
      <Helmet>
        <title>Portfolio | Matthew Florek</title>
        <meta
          name="description"
          content="View Matthew Florek's portfolio of data analysis and financial modeling projects."
        />
      </Helmet>

      <div className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl font-bold mb-8">Portfolio</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {projects.map((project, index) => (
                <motion.div
                  key={project.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.2 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>{project.title}</CardTitle>
                      <CardDescription>{project.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <img
                        src={project.image}
                        alt={project.title}
                        className="rounded-lg mb-4 w-full h-48 object-cover"
                      />
                      <div className="flex flex-wrap gap-2">
                        {project.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
