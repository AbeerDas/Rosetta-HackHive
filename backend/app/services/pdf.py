"""PDF generation service for exporting notes."""

import logging
from io import BytesIO
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


class PDFService:
    """Service for generating PDF exports of notes."""
    
    def __init__(self):
        self._weasyprint_available = False
        self._reportlab_available = False
        
        # Try to import weasyprint first
        try:
            import weasyprint
            self._weasyprint_available = True
            logger.info("WeasyPrint available for PDF generation")
        except ImportError:
            logger.warning("WeasyPrint not available, trying reportlab")
            
        # Fallback to reportlab
        if not self._weasyprint_available:
            try:
                from reportlab.lib.pagesizes import letter
                from reportlab.platypus import SimpleDocTemplate
                self._reportlab_available = True
                logger.info("ReportLab available for PDF generation")
            except ImportError:
                logger.warning("ReportLab not available")
    
    async def generate_pdf(
        self,
        html_content: str,
        title: Optional[str] = None,
        session_name: Optional[str] = None,
    ) -> bytes:
        """
        Generate PDF from HTML content.
        
        Args:
            html_content: HTML string to convert to PDF
            title: Optional title for the document
            session_name: Optional session name for the header
            
        Returns:
            PDF bytes
        """
        if self._weasyprint_available:
            return await self._generate_with_weasyprint(
                html_content, title, session_name
            )
        elif self._reportlab_available:
            return await self._generate_with_reportlab(
                html_content, title, session_name
            )
        else:
            raise RuntimeError(
                "No PDF generation library available. "
                "Install weasyprint or reportlab."
            )
    
    async def _generate_with_weasyprint(
        self,
        html_content: str,
        title: Optional[str],
        session_name: Optional[str],
    ) -> bytes:
        """Generate PDF using WeasyPrint."""
        import weasyprint
        
        # Wrap content in a styled HTML document
        styled_html = self._wrap_html(html_content, title, session_name)
        
        # Generate PDF
        pdf = weasyprint.HTML(string=styled_html).write_pdf()
        return pdf
    
    async def _generate_with_reportlab(
        self,
        html_content: str,
        title: Optional[str],
        session_name: Optional[str],
    ) -> bytes:
        """Generate PDF using ReportLab (simplified, no HTML support)."""
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, PageBreak
        )
        from html.parser import HTMLParser
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=inch,
            leftMargin=inch,
            topMargin=inch,
            bottomMargin=inch,
        )
        
        styles = getSampleStyleSheet()
        
        # Create custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=20,
        )
        
        # Parse HTML to plain text (simplified)
        plain_text = self._html_to_text(html_content)
        
        story = []
        
        # Add title if provided
        if title:
            story.append(Paragraph(title, title_style))
            story.append(Spacer(1, 12))
        
        if session_name:
            story.append(Paragraph(f"Session: {session_name}", styles['Normal']))
            story.append(Paragraph(
                f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                styles['Normal']
            ))
            story.append(Spacer(1, 24))
        
        # Add content paragraphs
        for paragraph in plain_text.split('\n\n'):
            if paragraph.strip():
                story.append(Paragraph(paragraph.strip(), styles['Normal']))
                story.append(Spacer(1, 12))
        
        doc.build(story)
        return buffer.getvalue()
    
    def _wrap_html(
        self,
        content: str,
        title: Optional[str],
        session_name: Optional[str],
    ) -> str:
        """Wrap HTML content in a styled document."""
        title_html = f"<h1>{title}</h1>" if title else ""
        session_html = f"""
            <div class="session-info">
                <p><strong>Session:</strong> {session_name}</p>
                <p><strong>Generated:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
            </div>
        """ if session_name else ""
        
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>{title or 'Lecture Notes'}</title>
            <style>
                @page {{
                    size: letter;
                    margin: 1in;
                    @top-right {{
                        content: "Page " counter(page) " of " counter(pages);
                        font-size: 10pt;
                        color: #666;
                    }}
                }}
                
                body {{
                    font-family: 'Georgia', serif;
                    font-size: 12pt;
                    line-height: 1.6;
                    color: #333;
                }}
                
                h1 {{
                    font-family: 'Helvetica', sans-serif;
                    font-size: 24pt;
                    color: #1a1a1a;
                    border-bottom: 2px solid #6366F1;
                    padding-bottom: 10pt;
                    margin-bottom: 20pt;
                }}
                
                h2 {{
                    font-family: 'Helvetica', sans-serif;
                    font-size: 18pt;
                    color: #333;
                    margin-top: 24pt;
                    margin-bottom: 12pt;
                }}
                
                h3 {{
                    font-family: 'Helvetica', sans-serif;
                    font-size: 14pt;
                    color: #444;
                    margin-top: 18pt;
                    margin-bottom: 8pt;
                }}
                
                p {{
                    margin-bottom: 12pt;
                    text-align: justify;
                }}
                
                .session-info {{
                    background: #f5f5f5;
                    padding: 12pt;
                    margin-bottom: 24pt;
                    border-radius: 4pt;
                    font-size: 10pt;
                    color: #666;
                }}
                
                .session-info p {{
                    margin: 4pt 0;
                    text-align: left;
                }}
                
                blockquote {{
                    border-left: 3pt solid #6366F1;
                    padding-left: 12pt;
                    margin: 12pt 0;
                    color: #555;
                    font-style: italic;
                }}
                
                ul, ol {{
                    margin: 12pt 0;
                    padding-left: 24pt;
                }}
                
                li {{
                    margin-bottom: 6pt;
                }}
                
                code {{
                    font-family: 'Courier New', monospace;
                    background: #f0f0f0;
                    padding: 2pt 4pt;
                    border-radius: 2pt;
                    font-size: 10pt;
                }}
                
                pre {{
                    background: #f5f5f5;
                    padding: 12pt;
                    border-radius: 4pt;
                    overflow-x: auto;
                    font-size: 10pt;
                }}
                
                sup {{
                    font-size: 8pt;
                    color: #6366F1;
                }}
                
                .citation {{
                    font-size: 10pt;
                    color: #666;
                    border-top: 1pt solid #ddd;
                    padding-top: 12pt;
                    margin-top: 24pt;
                }}
            </style>
        </head>
        <body>
            {title_html}
            {session_html}
            <div class="content">
                {content}
            </div>
        </body>
        </html>
        """
    
    def _html_to_text(self, html: str) -> str:
        """Convert HTML to plain text (simplified)."""
        import re
        
        # Remove script and style elements
        text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
        
        # Convert some HTML elements
        text = re.sub(r'<br\s*/?>', '\n', text)
        text = re.sub(r'<p[^>]*>', '\n\n', text)
        text = re.sub(r'</p>', '', text)
        text = re.sub(r'<h[1-6][^>]*>', '\n\n', text)
        text = re.sub(r'</h[1-6]>', '\n', text)
        text = re.sub(r'<li[^>]*>', '\n• ', text)
        
        # Remove remaining HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        
        # Decode HTML entities
        import html
        text = html.unescape(text)
        
        # Clean up whitespace
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = text.strip()
        
        return text


# Global instance
pdf_service = PDFService()
