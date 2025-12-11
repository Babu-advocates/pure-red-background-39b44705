import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DeedCustomFieldsProps {
  customPlaceholders: Record<string, string>;
  customValues: Record<string, string>;
  onCustomValueChange: (key: string, value: string) => void;
}

const DeedCustomFields = ({ 
  customPlaceholders, 
  customValues, 
  onCustomValueChange 
}: DeedCustomFieldsProps) => {
  // Only show custom placeholders from the deed type template
  if (!customPlaceholders || Object.keys(customPlaceholders).length === 0) {
    return null;
  }

  const formatLabel = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  return (
    <div className="space-y-3 p-3 bg-accent/5 rounded-md border border-accent/20">
      <h4 className="text-sm font-semibold text-accent">Additional Deed Information</h4>
      <div className="grid grid-cols-1 gap-3">
        {Object.entries(customPlaceholders).map(([key, description]) => {
          const inputId = `custom_${key}`;
          const isLongText = description.toLowerCase().includes('description') || 
                            description.toLowerCase().includes('details') ||
                            description.toLowerCase().includes('notes');
          
          return (
            <div key={key} className="space-y-1">
              <Label htmlFor={inputId} className="text-xs font-medium">
                {formatLabel(key)}
                {description && (
                  <span className="text-muted-foreground ml-1">({description})</span>
                )}
              </Label>
              {isLongText ? (
                <Textarea
                  id={inputId}
                  value={customValues[key] || ''}
                  onChange={(e) => onCustomValueChange(key, e.target.value)}
                  placeholder={`Enter ${formatLabel(key).toLowerCase()}`}
                  className="text-sm min-h-[120px] leading-relaxed whitespace-pre-wrap text-justify"
                />
              ) : (
                <Input
                  id={inputId}
                  value={customValues[key] || ''}
                  onChange={(e) => onCustomValueChange(key, e.target.value)}
                  placeholder={`Enter ${formatLabel(key).toLowerCase()}`}
                  className="text-sm"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DeedCustomFields;
