import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlogPostProps {
  title: string;
  description: string;
  content: string;
  image: string;
}

export default function BlogPost({ title, description, content, image }: BlogPostProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card 
      className="cursor-pointer transition-shadow hover:shadow-lg"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <CardContent className="p-6">
        <img
          src={image}
          alt={title}
          className="rounded-lg mb-4 w-full h-48 object-cover"
        />
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-semibold">{title}</h3>
          <ChevronDown 
            className={cn(
              "h-5 w-5 transition-transform",
              isExpanded && "transform rotate-180"
            )} 
          />
        </div>
        <p className="text-muted-foreground">{description}</p>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t">
                {content}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
