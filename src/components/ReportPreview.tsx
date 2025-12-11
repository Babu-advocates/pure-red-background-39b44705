import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye } from "lucide-react";
import { Deed } from "./DeedsTable";
import { DocumentDetail } from "./DocumentDetailsTable";
import { supabase } from "@/integrations/supabase/client";

interface ReportPreviewProps {
  placeholders: Record<string, string>;
  deeds: Deed[];
  deedsTable2?: Deed[];
  deedsTable3?: Deed[];
  deedsTable4?: Deed[];
  templateContent: string;
  documents?: DocumentDetail[];
}
const ReportPreview = ({
  placeholders,
  deeds,
  deedsTable2 = [],
  deedsTable3 = [],
  deedsTable4 = [],
  templateContent,
  documents = []
}: ReportPreviewProps) => {
  const [historyContent, setHistoryContent] = useState<string>("");
  const [deedTemplates, setDeedTemplates] = useState<Map<string, string>>(new Map());
  
  useEffect(() => {
    loadDeedTemplates();
  }, []);
  
  useEffect(() => {
    generateHistoryOfTitle();
  }, [deeds]);

  const loadDeedTemplates = async () => {
    const { data, error } = await supabase
      .from("deed_templates")
      .select("deed_type, preview_template");

    if (error) {
      console.error("Error loading deed templates:", error);
      return;
    }

    const templateMap = new Map<string, string>();
    (data || []).forEach((t: any) => {
      if (t?.deed_type) {
        templateMap.set(String(t.deed_type).trim().toLowerCase(), t.preview_template || "");
      }
    });
    setDeedTemplates(templateMap);
  };

  const generateDeedParticulars = (deed: Deed): string => {
    const key = String(deed.deed_type || "").trim().toLowerCase();
    const template = deedTemplates.get(key) || "";
    
    let particulars = template
      .replace(/{deedType}/gi, deed.deed_type || "")
      .replace(/{executedBy}/gi, deed.executed_by || "")
      .replace(/{inFavourOf}/gi, deed.in_favour_of || "")
      .replace(/{date}/gi, deed.date || "")
      .replace(/{documentNumber}/gi, deed.document_number || "")
      .replace(/{natureOfDoc}/gi, deed.nature_of_doc || "");

    // Replace custom field placeholders
    if (deed.custom_fields && typeof deed.custom_fields === "object") {
      Object.entries(deed.custom_fields).forEach(([key, value]) => {
        const regex = new RegExp(`\\{${key}\\}`, "gi");
        particulars = particulars.replace(regex, String(value ?? ""));
      });
    }

    return particulars;
  };
  const generateHistoryOfTitle = async () => {
    try {
      const deedsWithType = deeds.filter(d => d.deed_type);
      
      if (deedsWithType.length === 0) {
        setHistoryContent("");
        return;
      }

      // Fetch all templates once for efficiency
      const { data: templates, error } = await supabase
        .from("history_of_title_templates")
        .select("deed_type, template_content");

      if (error) {
        console.error("Error fetching history templates:", error);
        setHistoryContent("");
        return;
      }

      const templateMap = new Map<string, string>();
      (templates || []).forEach((t: any) => {
        if (t?.deed_type && t?.template_content) {
          templateMap.set(String(t.deed_type).trim().toLowerCase(), t.template_content);
        }
      });

      const historyParts: string[] = [];

      deedsWithType.forEach((deed, index) => {
        // Use the S.No from the deeds table (index + 1 for 1-based numbering)
        const serialNo = index + 1;
        const key = String(deed.deed_type).trim().toLowerCase();
        const template = templateMap.get(key);

        if (template) {
          let historyText = template
            .replace(/{executedBy}/gi, deed.executed_by || "")
            .replace(/{inFavourOf}/gi, deed.in_favour_of || "")
            .replace(/{date}/gi, deed.date || "")
            .replace(/{documentNumber}/gi, deed.document_number || "")
            .replace(/{deedType}/gi, deed.deed_type || "")
            .replace(/{natureOfDoc}/gi, deed.nature_of_doc || "");

          // Replace custom field placeholders
          if (deed.custom_fields && typeof deed.custom_fields === "object") {
            Object.entries(deed.custom_fields).forEach(([key, value]) => {
              const regex = new RegExp(`\\{${key}\\}`, "gi");
              historyText = historyText.replace(regex, String(value ?? ""));
            });
          }

          historyParts.push(historyText.trim());
        } else {
          // Fallback: create a basic entry when no template exists
          const fallbackText = `${deed.deed_type.toUpperCase()}:\n` +
            `Deed executed by ${deed.executed_by || '[Executor]'} in favour of ${deed.in_favour_of || '[Beneficiary]'} ` +
            `dated ${deed.date || '[Date]'}, Document No: ${deed.document_number || '[Doc No]'}` +
            (deed.nature_of_doc ? `, Nature: ${deed.nature_of_doc}` : '');
          
          historyParts.push(fallbackText);
        }
      });

      setHistoryContent(historyParts.join("\n\n"));
    } catch (e) {
      console.error("Error building history:", e);
      setHistoryContent("");
    }
  };
  const replacePlaceholders = (text: string) => {
    let result = text;

    // Replace single-brace placeholders {key}
    Object.entries(placeholders).forEach(([key, value]) => {
      const val = value || '';
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    });

    // Replace {$history} with generated history content
    result = result.replace(/\{\$history\}/gi, historyContent || '(History of Title will appear here when deeds are added)');
    return result;
  };
  const generateDeedsTableForType = (deedsList: Deed[]) => {
    if (deedsList.length === 0) return null;
    // Only include deeds with non-empty preview templates for the scrutiny table
    const validDeeds = deedsList.filter(deed => {
      if (!deed.deed_type) return false;
      const key = String(deed.deed_type).trim().toLowerCase();
      const template = deedTemplates.get(key) || "";
      return template.trim() !== "";
    });
    if (validDeeds.length === 0) return null;
    return <div style={{ margin: '4pt 0' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          border: '1px solid #000',
          fontFamily: 'Cambria, Georgia, serif',
          fontSize: '12pt'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#ffffff' }}>
              <th style={{ border: '1px solid #000', padding: '6pt', textAlign: 'left', fontWeight: 'bold' }}>Sno</th>
              <th style={{ border: '1px solid #000', padding: '6pt', textAlign: 'left', fontWeight: 'bold' }}>Date</th>
              <th style={{ border: '1px solid #000', padding: '6pt', textAlign: 'left', fontWeight: 'bold' }}>D.No</th>
              <th style={{ border: '1px solid #000', padding: '6pt', textAlign: 'left', fontWeight: 'bold' }}>Particulars of Deed</th>
              <th style={{ border: '1px solid #000', padding: '6pt', textAlign: 'left', fontWeight: 'bold' }}>Nature of Doc</th>
            </tr>
          </thead>
          <tbody>
              {validDeeds.map((deed, index) => <tr key={deed.id}>
                <td style={{ border: '1px solid #000', padding: '6pt' }}>{index + 1}</td>
                <td style={{ border: '1px solid #000', padding: '6pt' }}>{deed.date || 'Nil'}</td>
                <td style={{ border: '1px solid #000', padding: '6pt' }}>{deed.document_number || '-'}</td>
                <td style={{ border: '1px solid #000', padding: '6pt' }}>
                  {generateDeedParticulars(deed)}
                </td>
                <td style={{ border: '1px solid #000', padding: '6pt' }}>{deed.nature_of_doc || '-'}</td>
              </tr>)}
          </tbody>
        </table>
      </div>;
  };

  const generateDeedsTable = () => {
    if (deeds.length === 0) return null;
    // Only include deeds with non-empty preview templates for the scrutiny table
    const validDeeds = deeds.filter(deed => {
      if (!deed.deed_type) return false;
      const key = String(deed.deed_type).trim().toLowerCase();
      const template = deedTemplates.get(key) || "";
      return template.trim() !== "";
    });
    if (validDeeds.length === 0) return null;
    return <div style={{ margin: '4pt 0' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          border: '1px solid #000',
          fontFamily: 'Cambria, Georgia, serif',
          fontSize: '12pt'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#ffffff' }}>
              <th style={{ border: '1px solid #000', padding: '6pt', textAlign: 'left', fontWeight: 'bold' }}>Sno</th>
              <th style={{ border: '1px solid #000', padding: '6pt', textAlign: 'left', fontWeight: 'bold' }}>Date</th>
              <th style={{ border: '1px solid #000', padding: '6pt', textAlign: 'left', fontWeight: 'bold' }}>D.No</th>
              <th style={{ border: '1px solid #000', padding: '6pt', textAlign: 'left', fontWeight: 'bold' }}>Particulars of Deed</th>
              <th style={{ border: '1px solid #000', padding: '6pt', textAlign: 'left', fontWeight: 'bold' }}>Nature of Doc</th>
            </tr>
          </thead>
          <tbody>
            {validDeeds.map((deed, index) => <tr key={deed.id}>
                <td style={{ border: '1px solid #000', padding: '6pt' }}>{index + 1}</td>
                <td style={{ border: '1px solid #000', padding: '6pt' }}>{deed.date || 'Nil'}</td>
                <td style={{ border: '1px solid #000', padding: '6pt' }}>{deed.document_number || '-'}</td>
                <td style={{ border: '1px solid #000', padding: '6pt' }}>
                  {generateDeedParticulars(deed)}
                </td>
                <td style={{ border: '1px solid #000', padding: '6pt' }}>{deed.nature_of_doc || '-'}</td>
              </tr>)}
          </tbody>
        </table>
      </div>;
  };

  const generateDocumentDetailsTable = (sectionTitle: string, docsToShow: DocumentDetail[] = documents) => {
    // Helper function to convert number to Roman numerals
    const toRoman = (num: number): string => {
      const romanNumerals: [number, string][] = [
        [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
        [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
        [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']
      ];
      let result = '';
      for (const [value, numeral] of romanNumerals) {
        while (num >= value) {
          result += numeral;
          num -= value;
        }
      }
      return result;
    };
    
    const tableStyle = {
      width: '100%',
      borderCollapse: 'collapse' as const,
      border: '1px solid #000',
      fontFamily: 'Cambria, Georgia, serif',
      fontSize: '12pt',
      marginBottom: '4pt'
    };
    
    const cellStyle = {
      border: '1px solid #000',
      padding: '20pt 15pt',
      minHeight: '60pt',
      verticalAlign: 'top',
      lineHeight: '1.8'
    };
    
    return (
      <div style={{ margin: '6pt 0' }}>
        <h2 style={{ 
          fontWeight: 'bold', 
          fontSize: '14pt', 
          textAlign: 'center',
          marginBottom: '6pt',
          fontFamily: 'Cambria, Georgia, serif',
          textDecoration: 'underline'
        }}>
        {sectionTitle}
        </h2>
        {docsToShow.length === 0 ? (
          <div style={{ 
            margin: '12pt 0', 
            padding: '12pt', 
            border: '1px solid #ccc', 
            borderRadius: '4px', 
            backgroundColor: '#f9f9f9', 
            textAlign: 'center',
            fontFamily: 'Cambria, Georgia, serif',
            fontSize: '12pt',
            color: '#666'
          }}>
            <p style={{ fontStyle: 'italic' }}>Document details will appear here when you add them using the form above</p>
          </div>
        ) : (
          docsToShow.map((doc, docIndex) => (
          <div key={doc.id} style={{ marginBottom: docIndex < docsToShow.length - 1 ? '8pt' : '0' }}>
            <h3 style={{ 
              fontWeight: 'bold', 
              fontSize: '12pt', 
              textAlign: 'center',
              marginBottom: '6pt',
              fontFamily: 'Cambria, Georgia, serif'
            }}>
              As per Doc No : {doc.docNo || '(As per Doc.No)'}
            </h3>
            
            {/* Main Details Table - 3 columns */}
            <table style={tableStyle}>
              <tbody>
                <tr>
                  <td style={{ ...cellStyle, width: '48px' }}>i</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>Survey No</td>
                  <td style={cellStyle}>{doc.surveyNo || '(Survey No)'}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>ii</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>As per Revenue Record</td>
                  <td style={cellStyle}>{doc.asPerRevenueRecord || '(As per Revenue Record)'}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>iii</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>Total Extent</td>
                  <td style={cellStyle}>{doc.totalExtent || '(Total Extent)'}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>iv</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>Plot No</td>
                  <td style={cellStyle}>{doc.plotNo || '(Plot No)'}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>v</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>Location like name of the place, village, city, registration, sub-district etc.</td>
                  <td style={{ ...cellStyle, textAlign: 'justify', textJustify: 'inter-word' as any }}>{doc.location || '(Location like name of the place, village, city registration, sub-district etc.)'}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>vi</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>North By</td>
                  <td style={cellStyle}>{doc.northBy || '(North By)'}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>vii</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>South By</td>
                  <td style={cellStyle}>{doc.southBy || '(South By)'}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>viii</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>East By</td>
                  <td style={cellStyle}>{doc.eastBy || '(East By)'}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>ix</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>West By</td>
                  <td style={cellStyle}>{doc.westBy || '(West By)'}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>x</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>North - East West</td>
                  <td style={cellStyle}>{doc.northMeasurement || '30 ft'}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>xi</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>South - East West</td>
                  <td style={cellStyle}>{doc.southMeasurement || '30 ft'}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>xii</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>East - South North</td>
                  <td style={cellStyle}>{doc.eastMeasurement || '40 ft'}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>xiii</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>West - South North</td>
                  <td style={cellStyle}>{doc.westMeasurement || '40 ft'}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>xiv</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>Total</td>
                  <td style={cellStyle}>{doc.totalExtentSqFt || '1200 Sq.Ft'}</td>
                </tr>
                {doc.customMeasurements && Object.entries(doc.customMeasurements).map(([label, value], idx) => (
                  <tr key={label}>
                    <td style={cellStyle}>{toRoman(15 + idx)}</td>
                    <td style={{ ...cellStyle, fontWeight: 'bold' }}>{label}</td>
                    <td style={cellStyle}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )))}
      </div>
    );
  };
  const previewContent = templateContent ? replacePlaceholders(templateContent) : "Upload a Word template to see the preview here...";
  
  const renderContentWithTables = () => {
    const lines = previewContent.split('\n');
    const elements: JSX.Element[] = [];
    
    lines.forEach((line, lineIndex) => {
      // Check for table placeholders and insert tables
      if (line.includes('{table}') || line.includes('{{table}}')) {
        elements.push(
          <div key={`table-${lineIndex}`}>
            {generateDeedsTable()}
          </div>
        );
        return;
      }
      
      // {table1} - All documents
      if (line.includes('{table1}') || line.includes('{{table1}}')) {
        elements.push(
          <div key={`table1-${lineIndex}`}>
            {generateDocumentDetailsTable("Description of Property")}
          </div>
        );
        return;
      }
      
      // {table2} - First document only (or deeds from table2)
      if (line.includes('{table2}') || line.includes('{{table2}}')) {
        if (deedsTable2.length > 0) {
          // Show deeds table for table2
          elements.push(
            <div key={`table2-${lineIndex}`}>
              {generateDeedsTableForType(deedsTable2)}
            </div>
          );
        } else {
          // Fallback to first document
          const firstDoc = documents.length > 0 ? [documents[0]] : [];
          elements.push(
            <div key={`table2-${lineIndex}`}>
              {generateDocumentDetailsTable("Description of Documents Scrutinized 1", firstDoc)}
            </div>
          );
        }
        return;
      }
      
      // {table3} - Second document only (or deeds from table3)
      if (line.includes('{table3}') || line.includes('{{table3}}')) {
        if (deedsTable3.length > 0) {
          // Show deeds table for table3
          elements.push(
            <div key={`table3-${lineIndex}`}>
              {generateDeedsTableForType(deedsTable3)}
            </div>
          );
        } else {
          // Fallback to second document
          const secondDoc = documents.length > 1 ? [documents[1]] : [];
          elements.push(
            <div key={`table3-${lineIndex}`}>
              {generateDocumentDetailsTable("Description of Documents Scrutinized 2", secondDoc)}
            </div>
          );
        }
        return;
      }
      
      // {table4} - Third document only (or deeds from table4)
      if (line.includes('{table4}') || line.includes('{{table4}}')) {
        if (deedsTable4.length > 0) {
          // Show deeds table for table4
          elements.push(
            <div key={`table4-${lineIndex}`}>
              {generateDeedsTableForType(deedsTable4)}
            </div>
          );
        } else {
          // Fallback to third document
          const thirdDoc = documents.length > 2 ? [documents[2]] : [];
          elements.push(
            <div key={`table4-${lineIndex}`}>
              {generateDocumentDetailsTable("Description of Documents Scrutinized 3", thirdDoc)}
            </div>
          );
        }
        return;
      }

      // Regular line rendering
      const isHeading = /^(\d+\.?\s*)?[A-Z\s]+:/.test(line.trim());
      const isEmpty = !line.trim();
      
      if (isEmpty) {
        elements.push(<div key={lineIndex} style={{ height: '4pt' }} />);
        return;
      }
      
      if (isHeading) {
        elements.push(
          <h3 key={lineIndex} 
              style={{ 
                fontWeight: 'bold', 
                fontSize: '12pt',
                marginTop: '6pt',
                marginBottom: '4pt',
                fontFamily: 'Cambria, Georgia, serif',
                textDecoration: 'underline',
                color: '#000000'
              }}>
            {line}
          </h3>
        );
        return;
      }
      
      elements.push(
        <p key={lineIndex} 
           style={{ 
             fontSize: '12pt',
             lineHeight: '1.5',
             marginBottom: '3pt',
             fontFamily: 'Cambria, Georgia, serif',
             textAlign: 'justify',
             color: '#000000'
           }}>
          {line}
        </p>
      );
    });
    
    return elements;
  };
  
  return (
    <Card className="shadow-legal border-l-4 border-l-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-legal-header">
          <Eye className="h-5 w-5 text-primary" />
          Document Preview
        </CardTitle>
        <CardDescription>
          Preview of the generated document with placeholders replaced
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-white p-12 rounded-lg min-h-[300px] border border-border shadow-inner" 
             style={{ 
               maxWidth: '210mm', 
               margin: '0 auto',
               fontFamily: 'Cambria, Georgia, serif',
               fontSize: '12pt',
               lineHeight: '1.5',
               color: '#000000'
             }}>
          {renderContentWithTables()}
        </div>
      </CardContent>
    </Card>
  );
};
export default ReportPreview;