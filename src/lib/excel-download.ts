import * as XLSX from "xlsx";
import { format, parseISO } from "date-fns";

// Subject color map matching the Daily Transaction document
const SUBJ_COLORS: Record<string, string> = {
  English: "D9E1F2",
  Science: "E2EFDA",
  Math: "FFF2CC",
  Maths: "FFF2CC",
  Mathematics: "FFF2CC",
  "Social Science": "FCE4D6",
  "Social Studies": "FCE4D6",
  Social: "FCE4D6",
  "Hindi (2L)": "F4CCFF",
  "Hindi (3L)": "F4CCFF",
  Hindi: "F4CCFF",
  "2L Hindi": "F4CCFF",
  "Telugu (2L)": "D0E4FF",
  "Telugu (3L)": "D0E4FF",
  Telugu: "D0E4FF",
  "2L Telugu": "D0E4FF",
  "Art & Craft": "FFE0CC",
  Art: "FFE0CC",
  "Computer Science": "E0F7FA",
  Computer: "E0F7FA",
  Computers: "E0F7FA",
  Library: "F5F5DC",
  Yoga: "E8F5E9",
  "Western Dance": "FDE9D9",
  "Classical Dance": "FDE9D9",
  Music: "EDE7F6",
  Sports: "E8F5E9",
  PT: "E8F5E9",
};

type ClassworkItem = {
  subject: string;
  topicsCovered: string[];
  notes?: string;
  entryDate: string;
};

type HomeworkItem = {
  subject: string;
  description: string;
  dueDate: string;
  assignedDate: string;
  isComplete: boolean;
};

type ExamItem = {
  subject: string;
  examType: string;
  examDate: string;
  portions: string[];
  announcedDate: string;
  isAcknowledged: boolean;
  notes?: string;
};

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "dd-MMM-yyyy");
  } catch {
    return dateStr;
  }
}

function getDayName(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "EEEE");
  } catch {
    return "";
  }
}

function formatExamType(type: string): string {
  const map: Record<string, string> = {
    slip_test: "Slip Test",
    unit_test: "Unit Test",
    exam: "Exam",
    quiz: "Quiz",
    other: "Other",
  };
  return map[type] || type;
}

export function generateClassTrackerExcel(
  classwork: ClassworkItem[],
  homework: HomeworkItem[],
  exams: ExamItem[],
  childName: string,
  schoolName: string
) {
  const wb = XLSX.utils.book_new();

  // === Sheet 1: Daily Class Log ===
  const logRows: string[][] = [
    [`${schoolName} — ${childName} | Daily Class Log`],
    ["Date", "Day", "Subject", "Class Transaction / Topics Covered"],
  ];

  // Sort classwork by date asc
  const sortedClasswork = [...classwork].sort((a, b) =>
    a.entryDate.localeCompare(b.entryDate)
  );

  let prevDate = "";
  for (const item of sortedClasswork) {
    const dateVal = item.entryDate !== prevDate ? formatDate(item.entryDate) : "";
    const dayVal = item.entryDate !== prevDate ? getDayName(item.entryDate) : "";
    logRows.push([
      dateVal,
      dayVal,
      item.subject,
      item.topicsCovered.join("; "),
    ]);
    prevDate = item.entryDate;
  }

  const wsLog = XLSX.utils.aoa_to_sheet(logRows);
  wsLog["!cols"] = [{ wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 60 }];
  wsLog["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  XLSX.utils.book_append_sheet(wb, wsLog, "Daily Class Log");

  // === Sheet 2: Homework Tracker ===
  const hwRows: string[][] = [
    [`${schoolName} — ${childName} | Homework Tracker`],
    ["Mark Status: Pending | Completed | Incomplete"],
    [],
    [
      "Date Assigned",
      "Subject",
      "Homework Description",
      "Due Date",
      "Status",
      "Notes / Remarks",
    ],
  ];

  const sortedHw = [...homework].sort((a, b) =>
    a.assignedDate.localeCompare(b.assignedDate)
  );

  let totalHw = 0;
  let completedHw = 0;
  let pendingHw = 0;

  for (const item of sortedHw) {
    const status = item.isComplete ? "Completed" : "Pending";
    totalHw++;
    if (item.isComplete) completedHw++;
    else pendingHw++;

    hwRows.push([
      formatDate(item.assignedDate),
      item.subject,
      item.description,
      formatDate(item.dueDate),
      status,
      "",
    ]);
  }

  // Summary block
  hwRows.push([]);
  hwRows.push(["", "Total Homework Items:", String(totalHw)]);
  hwRows.push(["", "Completed:", String(completedHw)]);
  hwRows.push(["", "Pending:", String(pendingHw)]);

  const wsHw = XLSX.utils.aoa_to_sheet(hwRows);
  wsHw["!cols"] = [
    { wch: 16 },
    { wch: 18 },
    { wch: 52 },
    { wch: 14 },
    { wch: 16 },
    { wch: 28 },
  ];
  wsHw["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsHw, "Homework Tracker");

  // === Sheet 3: Exams & Tests ===
  const examRows: string[][] = [
    [`${schoolName} — ${childName} | Exams, Tests & Slip Tests`],
    [],
    [
      "Announced On",
      "Subject",
      "Exam / Test Type",
      "Exam Date",
      "Topics to Cover",
      "Preparation Status",
      "Remarks",
    ],
  ];

  const sortedExams = [...exams].sort((a, b) =>
    a.examDate.localeCompare(b.examDate)
  );

  for (const item of sortedExams) {
    examRows.push([
      formatDate(item.announcedDate),
      item.subject,
      formatExamType(item.examType),
      formatDate(item.examDate),
      item.portions.join("; "),
      item.isAcknowledged ? "Acknowledged" : "Not Prepared",
      item.notes || "",
    ]);
  }

  const wsExam = XLSX.utils.aoa_to_sheet(examRows);
  wsExam["!cols"] = [
    { wch: 16 },
    { wch: 18 },
    { wch: 20 },
    { wch: 14 },
    { wch: 48 },
    { wch: 20 },
    { wch: 28 },
  ];
  wsExam["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }];
  XLSX.utils.book_append_sheet(wb, wsExam, "Exams & Tests");

  // === Sheet 4: Subject Summary ===
  const summaryRows: string[][] = [
    [`${schoolName} — ${childName} | Subject-wise Learning Summary`],
    [],
    [
      "Subject",
      "Topics Covered",
      "Homework Given?",
      "Action for Parent",
    ],
  ];

  // Aggregate by subject
  const subjectMap = new Map<
    string,
    { topics: Set<string>; hasHomework: boolean; hwDetails: string[] }
  >();

  for (const item of classwork) {
    const existing = subjectMap.get(item.subject) ?? {
      topics: new Set<string>(),
      hasHomework: false,
      hwDetails: [],
    };
    item.topicsCovered.forEach((t) => existing.topics.add(t));
    subjectMap.set(item.subject, existing);
  }

  for (const item of homework) {
    const existing = subjectMap.get(item.subject) ?? {
      topics: new Set<string>(),
      hasHomework: false,
      hwDetails: [],
    };
    existing.hasHomework = true;
    existing.hwDetails.push(item.description);
    subjectMap.set(item.subject, existing);
  }

  for (const [subject, data] of subjectMap.entries()) {
    const topicsBullet = [...data.topics].map((t) => `• ${t}`).join("\n");
    const hwGiven = data.hasHomework
      ? `Yes — ${data.hwDetails.length} item(s)`
      : "No HW";
    const parentAction = data.hasHomework
      ? "Check homework completion and review topics"
      : "Review topics covered in class";

    summaryRows.push([subject, topicsBullet, hwGiven, parentAction]);
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 18 }, { wch: 55 }, { wch: 20 }, { wch: 40 }];
  wsSummary["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Subject Summary");

  // Generate and download
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${childName.replace(/\s+/g, "_")}_ClassTracker.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
