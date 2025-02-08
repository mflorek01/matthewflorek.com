export const skills = [
  { name: "Microsoft Excel", level: 95 },
  { name: "Financial Modeling", level: 80 },
  { name: "Data Analysis", level: 90 },
  { name: "Financial Literacy", level: 85 },
  { name: "Tableau", level: 75 },
] as const;

export const education = [
  { degree: "B.S. in Finance", institution: "Northern Arizona University", year: "2024" },
  { degree: "Certificate in Business Analytics", institution: "Northern Arizona University", year: "2024" },
  { degree: "SQL For Data Science Certification", institution: "UC Davis Extension", year: "2023" },
  // Add more education items here
] as const;

export const experience = [
  // Add your internships, projects, or relevant coursework here
  { title: "Data Analyst", company: "Neuromemex LLC", duration: "July 2022 - Present", description: "At my internship at Neuromemex, I did extensive data annotation and data quality management. Additionally, I conducted complex data transformations and used Microsoft Excel pivot table reports to deliver insight about their datasets." },
  { title: "AI Data Annotator", company: "Dataannotation.tech", duration: "March 2024 - August 2024", description: "At Dataannotation.tech, I did RLHF fine tuning, which is a necessary step in training AI models to give coherent responses as desired by their creator. As part of this, I graded model responses on a large variety of qualitative metrics, and engineered AI prompts designed to push the limits of the technology in the direction clients desired." },
  { title: "Production Assistant", company: "Northern Arizona University Printing Services", duration: "October 2022 - May 2023", description: "At NAU Printing Services, I was in charge of the finishing process of large-format media pieces, as well as making deliveries. I learned to work with deadlines, be repsponsive to customer requests, and work as part of a well-functioning team." },
] as const;

export const blogPosts = [

] as const;
