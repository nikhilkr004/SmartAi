import os
from fpdf import FPDF
from datetime import datetime

class StudyGuidePDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 12)
        self.cell(0, 10, "Smart AI Classroom Assistant - Study Guide", 0, 1, "C")
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.cell(0, 10, f"Page {self.page_no()}", 0, 0, "C")

def create_notes_pdf(notes: str, transcript: str, topic: str = "Class Session", output_path: str = "output.pdf") -> str:
    """
    Creates a premium PDF study guide from AI notes.
    """
    pdf = StudyGuidePDF()
    pdf.add_page()
    
    # 1. TOPIC HEADER
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(0, 96, 100) # Cyan 900
    pdf.cell(0, 15, topic.upper(), 0, 1, "L")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(5)

    # 2. NOTES SECTION
    pdf.set_font("Helvetica", "", 11)
    
    # Simple markdown-to-pdf logic (very basic)
    lines = notes.split("\n")
    for line in lines:
        if line.startswith("# "):
            pdf.ln(5)
            pdf.set_font("Helvetica", "B", 14)
            pdf.set_text_color(0, 121, 107) # Teal 700
            pdf.multi_cell(0, 10, line[2:].strip())
            pdf.set_text_color(0, 0, 0)
            pdf.set_font("Helvetica", "", 11)
        elif line.startswith("## "):
            pdf.set_font("Helvetica", "B", 12)
            pdf.multi_cell(0, 10, line[3:].strip())
            pdf.set_font("Helvetica", "", 11)
        elif "[TIP]" in line or "[DEF]" in line or "[HINT]" in line:
            pdf.set_font("Helvetica", "B", 11)
            pdf.set_fill_color(224, 242, 241) # Light Teal
            pdf.multi_cell(0, 8, line.strip(), 0, "L", fill=True)
            pdf.set_font("Helvetica", "", 11)
        else:
            pdf.multi_cell(0, 8, line.strip())

    # 3. TRANSCRIPT (Optional/Compact)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, "Original Transcript", 0, 1, "L")
    pdf.ln(5)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.multi_cell(0, 5, transcript)

    pdf.output(output_path)
    return output_path
