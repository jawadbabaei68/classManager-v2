// @ts-ignore
import pdfMake from "pdfmake/build/pdfmake";
// @ts-ignore
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import { Classroom, ClassType } from "../types";


// Setup Virtual File System (VFS) for pdfmake
// This handles different structures that pdfFonts might have depending on the build
const fontModule = pdfFonts as any;
if (fontModule && fontModule.pdfMake && fontModule.pdfMake.vfs) {
    (pdfMake as any).vfs = fontModule.pdfMake.vfs;
} else if (fontModule && fontModule.vfs) {
    (pdfMake as any).vfs = fontModule.vfs;
} else if (fontModule) {
    (pdfMake as any).vfs = fontModule;
} else {
    (pdfMake as any).vfs = {};
}

// Ensure vfs object exists
if (!(pdfMake as any).vfs) {
    (pdfMake as any).vfs = {};
}

// Load Persian font from local file
const loadPersianFont = async () => {
    try {
        // Fetch the local font file
        // Ensure this path matches exactly where the file is located in public/ directory
        const response = await fetch('/fonts/Vazir-Bold.ttf');
        if (!response.ok) {
            throw new Error(`Font fetch failed: ${response.status} ${response.statusText}`);

        }
        const buffer = await response.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    } catch (error) {
        console.warn("Failed to load Persian font:", error);
        return null;
    }
};

export const exportClassReportPDF = async (classroom: Classroom) => {

    const persianFontBase64 = await loadPersianFont();
    const FONT_FILENAME = 'Vazir-Bold.ttf';

    if (!persianFontBase64) {
        alert("هشدار: فونت فارسی بارگذاری نشد. خروجی PDF ممکن است ناخوانا باشد.");
    } else {
        // Register font in VFS with the exact filename expected by fonts config
        (pdfMake as any).vfs[FONT_FILENAME] = persianFontBase64;

    }

    const fonts = {
        Roboto: {
            normal: 'Roboto-Regular.ttf',
            bold: 'Roboto-Medium.ttf',
            italics: 'Roboto-Italic.ttf',
            bolditalics: 'Roboto-MediumItalic.ttf'
        },
        ...(persianFontBase64 ? {
            Vazirmatn: {
                normal: FONT_FILENAME,
                bold: FONT_FILENAME,
                italics: FONT_FILENAME,
                bolditalics: FONT_FILENAME
            }
        } : {})
    };


    const isModular = classroom.type === ClassType.MODULAR;

    // Define Headers
    const headers: any[] = [];
    const widths: any[] = [];


    headers.push({ text: 'توضیحات', style: 'tableHeader' });
    widths.push('*');

    if (isModular) {
        [5, 4, 3, 2, 1].forEach(i => {
            headers.push({ text: `پودمان ${i}`, style: 'tableHeader' });
            widths.push(35);
        });
    } else {
        headers.push({ text: 'پایانی ۲', style: 'tableHeader' }); widths.push(40);
        headers.push({ text: 'مستمر ۲', style: 'tableHeader' }); widths.push(40);
        headers.push({ text: 'پایانی ۱', style: 'tableHeader' }); widths.push(40);
        headers.push({ text: 'مستمر ۱', style: 'tableHeader' }); widths.push(40);
    }

    headers.push({ text: 'غیبت', style: 'tableHeader' }); widths.push(35);
    headers.push({ text: 'نام دانش‌آموز', style: 'tableHeader' }); widths.push(100);
    headers.push({ text: 'ردیف', style: 'tableHeader' }); widths.push(25);

    const docDefinition: any = {
        pageSize: 'A4',

        pageOrientation: 'portrait',

        info: {
            title: `Report ${classroom.name}`,
            author: 'Madrese Yar'
        },
        content: [
            { text: `گزارش جامع کلاس ${classroom.name}`, style: 'header' },
            { text: `درس: ${classroom.bookName}  |  سال تحصیلی: ${classroom.academicYear}`, style: 'subheader' },
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
                    paddingLeft: function() { return 4; },
                    paddingRight: function() { return 4; },
                    paddingTop: function() { return 4; },
                    paddingBottom: function() { return 4; },

                }
            }
        ],
        styles: {

            header: { fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 10] },
            subheader: { fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 20], color: '#4B5563' },
            tableHeader: { bold: true, fontSize: 10, color: 'white', fillColor: '#059669', alignment: 'center', margin: [0, 2, 0, 2] },
            tableCell: { fontSize: 9, alignment: 'center', margin: [0, 2, 0, 2] },
            tableCellName: { fontSize: 9, alignment: 'right', bold: true, margin: [0, 2, 5, 2] }

        },
        defaultStyle: {
            font: persianFontBase64 ? 'Vazirmatn' : 'Roboto',
            direction: 'rtl'
        }
    };


    // NOTE: Removed applyArabicShaping as the module "pdfmake-unicode-rtl" is not resolved
    // This may affect the connectivity of Persian letters in the PDF.
    
    // Create PDF with explicitly passed fonts and VFS
    pdfMake.createPdf(docDefinition, null, fonts, (pdfMake as any).vfs)
        .download(`${classroom.name}_FullReport.pdf`);

};

// Row Generator
const generateRows = (classroom: Classroom, isModular: boolean) => {
    return classroom.students.map((student, index) => {
        const perf = classroom.performance?.find(p => p.studentId === student.id);

        let absentCount = 0;
        classroom.sessions.forEach(sess => {
            const r = sess.records.find(rec => rec.studentId === student.id);
            if (r?.attendance === 'ABSENT') absentCount++;
        });

        let notes = '';
        if (absentCount > 3) notes += `هشدار غیبت (${absentCount}) `;

        let discCount = 0;
        classroom.sessions.forEach(sess => {
            const r = sess.records.find(rec => rec.studentId === student.id);
            if (r?.discipline?.badBehavior || r?.discipline?.expelled || r?.discipline?.sleep) discCount++;

        });
        if (disc > 0) notes += `| موارد انضباطی: ${disc}`;


        // Reverse text for simple RTL fix (basic workaround without shaper) if needed, 
        // but often raw text is better than reversed disjoint characters.
        // We leave it as is.

        const row: any[] = [];
        row.push({ text: notes || '-', style: 'tableCell', alignment: 'right', direction: 'rtl' });

        if (isModular) {
            [5, 4, 3, 2, 1].forEach(i => {
                const grade = perf?.gradesModular.find(g => g.moduleId === i);
                row.push({ text: grade?.score ?? '-', style: 'tableCell', alignment: 'center' });

            });
        } else {
            const t2 = perf?.gradesTerm.find(g => g.termId === 2);
            const t1 = perf?.gradesTerm.find(g => g.termId === 1);

            row.push({ text: t2?.final ?? '-', style: 'tableCell', alignment: 'center' });
            row.push({ text: t2?.continuous ?? '-', style: 'tableCell', alignment: 'center' });
            row.push({ text: t1?.final ?? '-', style: 'tableCell', alignment: 'center' });
            row.push({ text: t1?.continuous ?? '-', style: 'tableCell', alignment: 'center' });
        }

        row.push({ text: absentCount > 0 ? absentCount.toString() : '-', style: 'tableCell', color: absentCount > 3 ? 'red' : 'black', alignment: 'center' });
        row.push({ text: student.name, style: 'tableCellName', alignment: 'right', direction: 'rtl' });
        row.push({ text: (index + 1).toString(), style: 'tableCell', alignment: 'center' });


        return row;
    });
};
