export const homeServices = [
  {
    id: 'agronomy-support',
    title: 'Agronomy support',
    description: 'Practical guidance on planting, crop nutrition, and ongoing farm care.',
    icon: 'leaf',
  },
  {
    id: 'soil-testing',
    title: 'Soil testing',
    description: "Understand your soil's pH and nutrient needs to make informed planting decisions.",
    icon: 'flask',
  },
  {
    id: 'irrigation-services',
    title: 'Irrigation services',
    description: "Planning, installation, and maintenance of irrigation systems tailored to your farm's watering needs.",
    icon: 'droplet',
  },
];

export function serviceWhatsAppUrl(serviceTitle) {
  const message = `Hello Savannah Seedlings, I would like to enquire about ${serviceTitle.toLowerCase()}. Please advise on availability and pricing.`;
  return `https://wa.me/254710583989?text=${encodeURIComponent(message)}`;
}
