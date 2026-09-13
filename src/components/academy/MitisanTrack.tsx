"use client";

import { ExternalLink, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuizSimulator } from "@/components/academy/QuizSimulator";

const MITISAN_COURSE_URL = "https://metis-ops.com/Loggedin/licensepathmitisan";

/**
 * The hobby ("מטיסן") track — free, no purchase gate. The theory course itself lives on the main
 * MetisOps site (login-gated there, so it's a real outbound link rather than an embed); this app
 * hosts the exam-prep simulator alongside it, open to everyone.
 */
export function MitisanTrack() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              קורס מטיסן — תיאוריה מלאה
            </CardTitle>
            <Badge variant="success">חינם</Badge>
          </div>
          <CardDescription>לימוד התיאוריה המלאה מתבצע באתר MetisOps, במסלול הרישוי הקיים שלכם</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href={MITISAN_COURSE_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              מעבר לקורס באתר MetisOps
            </a>
          </Button>
        </CardContent>
      </Card>

      <QuizSimulator />
    </div>
  );
}
