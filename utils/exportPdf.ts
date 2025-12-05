
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { Classroom, ClassType } from "../types";

// Assign vfs for client-side usage
if (pdfFonts && pdfFonts.pdfMake) {
    pdfMake.vfs = pdfFonts.pdfMake.vfs;
} else if (pdfFonts) {
    (pdfMake as any).vfs = pdfFonts;
}

const loadPersianFont = async () => {
    // List of reliable sources for Vazirmatn font
    const fontUrls = [
        'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.0.3/fonts/ttf/Vazirmatn-Regular.ttf',
        'https://raw.githubusercontent.com/rastikerdar/vazirmatn/master/fonts/ttf/Vazirmatn-Regular.ttf',
        'https://github.com/rastikerdar/vazirmatn/blob/master/fonts/ttf/Vazirmatn-Regular.ttf?raw=true'
    ];

    for (const url of fontUrls) {
        try {
            const response = await fetch(url, { cache: 'force-cache' });
            if (!response.ok) continue;
            
            const buffer = await response.arrayBuffer();
            let binary = '';
            const bytes = new Uint8Array(buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = window.btoa(binary);
            if (base64 && base64.length > 100) {
                return base64;
            }
        } catch (error) {
            console.warn(`Failed to load font from ${url}`, error);
        }
    }
    return null;
};

export const exportClassReportPDF = async (classroom: Classroom) => {
    let persianFontBase64 = null;
    
    try {
        persianFontBase64 = await loadPersianFont();
    } catch (e) {
        console.error("Critical error loading font", e);
    }

    if (!persianFontBase64) {
        alert("هشدار: فونت فارسی بارگذاری نشد. فایل خروجی ممکن است ناخوانا باشد. لطفاً اتصال اینترنت خود را بررسی کنید.");
    }
    
    // Configure Fonts
    const fonts = {
        Roboto: {
            normal: 'Roboto-Regular.ttf',
            bold: 'Roboto-Medium.ttf',
            italics: 'Roboto-Italic.ttf',
            bolditalics: 'Roboto-MediumItalic.ttf'
        },
        ...(persianFontBase64 ? {
            Vazirmatn: {
                normal: 'Vazirmatn.ttf',
                bold: 'Vazirmatn.ttf',
                italics: 'Vazirmatn.ttf',
                bolditalics: 'Vazirmatn.ttf'
            }
        } : {})
    };

    // Add to VFS
    if (persianFontBase64) {
        if (!pdfMake.vfs) pdfMake.vfs = {};
        pdfMake.vfs["Vazirmatn.ttf"] = persianFontBase64;
    }

    const isModular = classroom.type === ClassType.MODULAR;

    // Define Header Columns (Visual Left-to-Right for RTL PDF)
    // RTL Layout: [Notes] ... [Grades] ... [Absence] [Name] [Row]
    
    const headers = [];
    const widths = [];

    // 1. Notes (Leftmost visually)
    headers.push({ text: 'توضیحات', style: 'tableHeader' });
    widths.push('*');

    // 2. Grades (Reverse order for RTL visual: Last to First)
    if (isModular) {
        // Pod 5 -> Pod 1
        [5, 4, 3, 2, 1].forEach(i => {
             headers.push({ text: `پودمان ${i}`, style: 'tableHeader' });
             widths.push(35);
        });
    } else {
        // Term 2 Final, Term 2 Cont, Term 1 Final, Term 1 Cont
        headers.push({ text: 'پایانی ۲', style: 'tableHeader' });
        widths.push(40);
        headers.push({ text: 'مستمر ۲', style: 'tableHeader' });
        widths.push(40);
        headers.push({ text: 'پایانی ۱', style: 'tableHeader' });
        widths.push(40);
        headers.push({ text: 'مستمر ۱', style: 'tableHeader' });
        widths.push(40);
    }

    // 3. Absences
    headers.push({ text: 'غیبت', style: 'tableHeader' });
    widths.push(35);

    // 4. Name
    headers.push({ text: 'نام دانش‌آموز', style: 'tableHeader' });
    widths.push(100);

    // 5. Row (Rightmost visually)
    headers.push({ text: 'ردیف', style: 'tableHeader' });
    widths.push(25);


    const docDefinition: any = {
        pageSize: 'A4',
        pageOrientation: isModular ? 'landscape' : 'portrait', // Landscape for modular to fit 5 pods
        info: {
            title: `Report ${classroom.name}`,
            author: 'Madrese Yar',
        },
        content: [
            { text: `گزارش جامع کلاس ${classroom.name}`, style: 'header' },
            { text: `درس: ${classroom.bookName} | سال تحصیلی: ${classroom.academicYear}`, style: 'subheader' },
            {
                table: {
                    headerRows: 1,
                    widths: widths,
                    body: [
                        headers,
                        ...generateRows(classroom, isModular)
                    ]
                },
                layout: {
                    fillColor: function (rowIndex: number) {
                        return (rowIndex % 2 === 0) ? '#F3F4F6' : null;
                    },
                    hLineWidth: function (i: number, node: any) {
                        return (i === 0 || i === node.table.body.length) ? 2 : 1;
                    },
                    vLineWidth: function (i: number, node: any) {
                        return (i === 0 || i === node.table.widths.length) ? 2 : 1;
                    },
                    hLineColor: function (i: number, node: any) {
                        return (i === 0 || i === node.table.body.length) ? '#111827' : '#9CA3AF';
                    },
                    vLineColor: function (i: number, node: any) {
                        return (i === 0 || i === node.table.widths.length) ? '#111827' : '#9CA3AF';
                    },
                    paddingLeft: function(i: number) { return 4; },
                    paddingRight: function(i: number) { return 4; },
                    paddingTop: function(i: number) { return 4; },
                    paddingBottom: function(i: number) { return 4; },
                }
            }
        ],
        styles: {
            header: {
                fontSize: 18,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 10]
            },
            subheader: {
                fontSize: 14,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 20],
                color: '#4B5563'
            },
            tableHeader: {
                bold: true,
                fontSize: 10,
                color: 'white',
                fillColor: '#059669', // Emerald 600
                alignment: 'center',
                margin: [0, 2, 0, 2]
            },
            tableCell: {
                fontSize: 9,
                alignment: 'center',
                margin: [0, 2, 0, 2]
            },
            tableCellName: {
                fontSize: 9,
                alignment: 'right', // Align names right for Persian
                bold: true,
                margin: [0, 2, 5, 2]
            }
        },
        defaultStyle: {
            font: persianFontBase64 ? 'Vazirmatn' : 'Roboto',
            direction: 'rtl' // Enable RTL
        }
    };

    // @ts-ignore
    pdfMake.createPdf(docDefinition, null, fonts, pdfMake.vfs).download(`${classroom.name}_FullReport.pdf`);
};

const generateRows = (classroom: Classroom, isModular: boolean) => {
    return classroom.students.map((student, index) => {
        const perf = classroom.performance?.find(p => p.studentId === student.id);
        
        // Calculate Absences
        let absentCount = 0;
        classroom.sessions.forEach(sess => {
            const r = sess.records.find(rec => rec.studentId === student.id);
            if (r?.attendance === 'ABSENT') absentCount++;
        });

        // Generate Notes (aggregated)
        let notes = '';
        if (absentCount > 3) notes += `هشدار غیبت (${absentCount}) `;
        // Add disciplinary notes if needed, keeping it brief
        let discCount = 0;
        classroom.sessions.forEach(sess => {
            const r = sess.records.find(rec => rec.studentId === student.id);
            if (r?.discipline?.badBehavior || r?.discipline?.expelled || r?.discipline?.sleep) discCount++;
        });
        if (discCount > 0) notes += `| موارد انضباطی: ${discCount}`;

        const row = [];

        // 1. Notes
        row.push({ text: notes, style: 'tableCell', alignment: 'right' });

        // 2. Grades
        if (isModular) {
            // Pod 5 -> Pod 1
            [5, 4, 3, 2, 1].forEach(i => {
                const grade = perf?.gradesModular.find(g => g.moduleId === i);
                const score = grade && grade.score !== undefined ? grade.score : '-';
                row.push({ text: score, style: 'tableCell' });
            });
        } else {
            // Term 2 Final, Term 2 Cont, Term 1 Final, Term 1 Cont
            const t2 = perf?.gradesTerm.find(g => g.termId === 2);
            const t1 = perf?.gradesTerm.find(g => g.termId === 1);
            
            row.push({ text: t2?.final !== undefined ? t2.final : '-', style: 'tableCell' });
            row.push({ text: t2?.continuous !== undefined ? t2.continuous : '-', style: 'tableCell' });
            row.push({ text: t1?.final !== undefined ? t1.final : '-', style: 'tableCell' });
            row.push({ text: t1?.continuous !== undefined ? t1.continuous : '-', style: 'tableCell' });
        }

        // 3. Absences
        row.push({ text: absentCount > 0 ? absentCount.toString() : '-', style: 'tableCell', color: absentCount > 3 ? 'red' : 'black' });

        // 4. Name
        row.push({ text: student.name, style: 'tableCellName' });

        // 5. Row Number
        row.push({ text: (index + 1).toString(), style: 'tableCell' });

        return row;
    });
};
