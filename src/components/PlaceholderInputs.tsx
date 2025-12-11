import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PlaceholderInputsProps {
  placeholders: Record<string, string>;
  onPlaceholderChange: (key: string, value: string) => void;
}

const PlaceholderInputs = ({ placeholders, onPlaceholderChange }: PlaceholderInputsProps) => {
  const formatLabel = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  return (
    <Card className="shadow-xl hover:shadow-2xl transition-all duration-500 border-t-4 border-t-primary bg-gradient-to-br from-card to-muted/10">
      <CardHeader>
        <CardTitle className="text-legal-header text-xl">Document Details</CardTitle>
        <CardDescription className="text-base">Fill in the required information for the legal scrutiny report</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(placeholders).map(([key, value], index) => {
            const inputId = key.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
            return (
              <div 
                key={key} 
                className="space-y-2 animate-fade-in" 
                style={{ 
                  animationDelay: `${index * 0.05}s`,
                  animationFillMode: 'both'
                }}
              >
                <Label htmlFor={inputId} className="text-sm font-medium">
                  {formatLabel(key)}
                </Label>
                <Input
                  id={inputId}
                  value={value}
                  onChange={(e) => onPlaceholderChange(key, e.target.value)}
                  placeholder={`Enter ${formatLabel(key).toLowerCase()}`}
                  className="transition-all duration-200 focus:ring-2 focus:ring-legal-header hover:border-primary focus:scale-[1.02] h-11 border-2"
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default PlaceholderInputs;
