// @ts-ignore
import pdfMake from "pdfmake/build/pdfmake";
// @ts-ignore
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import { Classroom, ClassType } from "../types";

<<<<<<< HEAD
// Attach VFS fonts
(pdfMake as any).vfs = (pdfFonts as any).vfs;

const loadPersianFont = async () => {
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
            if (base64 && base64.length > 100) return base64;
        } catch (e) {
            console.warn(`Font load failed: ${url}`, e);
=======
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
>>>>>>> 74a6dd9 (app version to 3.1.3)
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
<<<<<<< HEAD
    let persianFontBase64 = null;

    try {
        persianFontBase64 = await loadPersianFont();
    } catch (e) {
        console.error("Font load critical error", e);
    }

    if (!persianFontBase64) {
        alert("فونت فارسی بارگذاری نشد. ممکن است PDF ناخوانا باشد.");
=======
    const persianFontBase64 = await loadPersianFont();
    const FONT_FILENAME = 'Vazir-Bold.ttf';

    if (!persianFontBase64) {
        alert("هشدار: فونت فارسی بارگذاری نشد. خروجی PDF ممکن است ناخوانا باشد.");
    } else {
        // Register font in VFS with the exact filename expected by fonts config
        (pdfMake as any).vfs[FONT_FILENAME] = persianFontBase64;
>>>>>>> 74a6dd9 (app version to 3.1.3)
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

<<<<<<< HEAD
    if (persianFontBase64) {
        pdfMake.vfs["Vazirmatn.ttf"] = persianFontBase64;
    }

    const isModular = classroom.type === ClassType.MODULAR;

    const headers = [];
    const widths = [];
=======
    const isModular = classroom.type === ClassType.MODULAR;

    // Define Headers
    const headers: any[] = [];
    const widths: any[] = [];
>>>>>>> 74a6dd9 (app version to 3.1.3)

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
<<<<<<< HEAD
        pageOrientation: isModular ? 'landscape' : 'portrait',
=======
        pageOrientation: 'portrait',
>>>>>>> 74a6dd9 (app version to 3.1.3)
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
<<<<<<< HEAD
                    fillColor: (i: number) => (i % 2 === 0 ? '#F3F4F6' : null),
                    hLineWidth: (i: number, n: any) => (i === 0 || i === n.table.body.length ? 2 : 1),
                    vLineWidth: (i: number, n: any) => (i === 0 || i === n.table.widths.length ? 2 : 1),
                    hLineColor: (i: number, n: any) => (i === 0 || i === n.table.body.length ? '#111827' : '#9CA3AF'),
                    vLineColor: (i: number, n: any) => (i === 0 || i === n.table.widths.length ? '#111827' : '#9CA3AF')
=======
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
>>>>>>> 74a6dd9 (app version to 3.1.3)
                }
            }
        ],
        styles: {
<<<<<<< HEAD
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
                fillColor: '#059669',
                alignment: 'center',
                margin: [0, 2, 0, 2]
            },
            tableCell: {
                fontSize: 9,
                alignment: 'center'
            },
            tableCellName: {
                fontSize: 9,
                alignment: 'right',
                bold: true
            }
=======
            header: { fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 10] },
            subheader: { fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 20], color: '#4B5563' },
            tableHeader: { bold: true, fontSize: 10, color: 'white', fillColor: '#059669', alignment: 'center', margin: [0, 2, 0, 2] },
            tableCell: { fontSize: 9, alignment: 'center', margin: [0, 2, 0, 2] },
            tableCellName: { fontSize: 9, alignment: 'right', bold: true, margin: [0, 2, 5, 2] }
>>>>>>> 74a6dd9 (app version to 3.1.3)
        },
        defaultStyle: {
            font: persianFontBase64 ? 'Vazirmatn' : 'Roboto',
            direction: 'rtl'
        }
    };

<<<<<<< HEAD
    pdfMake.createPdf(docDefinition).download(`${classroom.name}_FullReport.pdf`);
=======
    // NOTE: Removed applyArabicShaping as the module "pdfmake-unicode-rtl" is not resolved
    // This may affect the connectivity of Persian letters in the PDF.
    
    // Create PDF with explicitly passed fonts and VFS
    pdfMake.createPdf(docDefinition, null, fonts, (pdfMake as any).vfs)
        .download(`${classroom.name}_FullReport.pdf`);
>>>>>>> 74a6dd9 (app version to 3.1.3)
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
<<<<<<< HEAD

        let disc = 0;
        classroom.sessions.forEach(s => {
            const r = s.records.find(x => x.studentId === student.id);
            if (r?.discipline?.badBehavior || r?.discipline?.expelled || r?.discipline?.sleep) disc++;
=======
        let discCount = 0;
        classroom.sessions.forEach(sess => {
            const r = sess.records.find(rec => rec.studentId === student.id);
            if (r?.discipline?.badBehavior || r?.discipline?.expelled || r?.discipline?.sleep) discCount++;
>>>>>>> 74a6dd9 (app version to 3.1.3)
        });
        if (disc > 0) notes += `| موارد انضباطی: ${disc}`;

<<<<<<< HEAD
        const row = [];
        row.push({ text: notes, style: 'tableCell', alignment: 'right' });

        if (isModular) {
            [5, 4, 3, 2, 1].forEach(i => {
                const g = perf?.gradesModular.find(x => x.moduleId === i);
                row.push({ text: g?.score ?? '-', style: 'tableCell' });
=======
        // Reverse text for simple RTL fix (basic workaround without shaper) if needed, 
        // but often raw text is better than reversed disjoint characters.
        // We leave it as is.

        const row: any[] = [];
        row.push({ text: notes || '-', style: 'tableCell', alignment: 'right', direction: 'rtl' });

        if (isModular) {
            [5, 4, 3, 2, 1].forEach(i => {
                const grade = perf?.gradesModular.find(g => g.moduleId === i);
                row.push({ text: grade?.score ?? '-', style: 'tableCell', alignment: 'center' });
>>>>>>> 74a6dd9 (app version to 3.1.3)
            });
        } else {
            const t2 = perf?.gradesTerm.find(g => g.termId === 2);
            const t1 = perf?.gradesTerm.find(g => g.termId === 1);
<<<<<<< HEAD

            row.push({ text: t2?.final ?? '-', style: 'tableCell' });
            row.push({ text: t2?.continuous ?? '-', style: 'tableCell' });
            row.push({ text: t1?.final ?? '-', style: 'tableCell' });
            row.push({ text: t1?.continuous ?? '-', style: 'tableCell' });
        }

        row.push({ text: absentCount > 0 ? String(absentCount) : '-', style: 'tableCell', color: absentCount > 3 ? 'red' : 'black' });
        row.push({ text: student.name, style: 'tableCellName' });
        row.push({ text: String(index + 1), style: 'tableCell' });
=======
            row.push({ text: t2?.final ?? '-', style: 'tableCell', alignment: 'center' });
            row.push({ text: t2?.continuous ?? '-', style: 'tableCell', alignment: 'center' });
            row.push({ text: t1?.final ?? '-', style: 'tableCell', alignment: 'center' });
            row.push({ text: t1?.continuous ?? '-', style: 'tableCell', alignment: 'center' });
        }

        row.push({ text: absentCount > 0 ? absentCount.toString() : '-', style: 'tableCell', color: absentCount > 3 ? 'red' : 'black', alignment: 'center' });
        row.push({ text: student.name, style: 'tableCellName', alignment: 'right', direction: 'rtl' });
        row.push({ text: (index + 1).toString(), style: 'tableCell', alignment: 'center' });
>>>>>>> 74a6dd9 (app version to 3.1.3)

        return row;
    });
};
