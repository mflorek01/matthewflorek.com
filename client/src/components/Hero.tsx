import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronRight, BarChart2 } from "lucide-react";
import { Link } from "wouter";

export default function Hero() {
  return (
    <div className="relative min-h-[90vh] flex items-center">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Data-Driven Insights & Financial Analysis
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Transforming complex data into actionable business intelligence through
            advanced analytics and financial modeling.
          </p>
          <div className="flex gap-4">
            <Link href="/portfolio">
              <Button size="lg">
                View Portfolio
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/about">
              <Button variant="outline" size="lg">
                Learn More
                <BarChart2 className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
