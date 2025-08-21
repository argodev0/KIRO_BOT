/**
 * Alpha Testing Feedback Service
 * Comprehensive feedback collection and bug reporting system for alpha testing
 */

import { PrismaClient } from '@prisma/client';
import { productionLogger } from './ProductionLoggingService';
import { auditService } from './AuditService';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

interface BugReport {
  id?: string;
  testerId: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'ui' | 'functionality' | 'performance' | 'security' | 'data' | 'integration' | 'other';
  stepsToReproduce: string[];
  expectedBehavior: string;
  actualBehavior: string;
  environment: {
    browser: string;
    os: string;
    screenResolution: string;
    userAgent: string;
  };
  attachments?: string[];
  consoleErrors?: string[];
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'duplicate';
  priority: 'p1' | 'p2' | 'p3' | 'p4';
  assignedTo?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface FeatureRequest {
  id?: string;
  testerId: string;
  title: string;
  description: string;
  useCase: string;
  proposedSolution?: string;
  alternativeSolutions?: string[];
  priority: 'high' | 'medium' | 'low';
  category: 'trading' | 'ui' | 'analytics' | 'security' | 'performance' | 'integration' | 'other';
  businessValue: string;
  technicalComplexity?: 'low' | 'medium' | 'high';
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'implemented';
  votes: number;
  comments: FeatureComment[];
  metadata?: Record<string, any>;
}

interface FeatureComment {
  id: string;
  testerId: string;
  comment: string;
  timestamp: Date;
}

interface GeneralFeedback {
  id?: string;
  testerId: string;
  category: 'usability' | 'performance' | 'design' | 'documentation' | 'onboarding' | 'general';
  rating: number; // 1-10 scale
  feedback: string;
  suggestions?: string;
  wouldRecommend: boolean;
  mostUsefulFeature?: string;
  leastUsefulFeature?: string;
  missingFeatures?: string[];
  metadata?: Record<string, any>;
}

interface TestingSession {
  id?: string;
  testerId: string;
  sessionType: 'guided' | 'exploratory' | 'scenario' | 'performance';
  scenario?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tasksCompleted: string[];
  tasksSkipped: string[];
  issuesEncountered: string[];
  overallRating: number;
  notes?: string;
  metadata?: Record<string, any>;
}

interface AlphaTester {
  id: string;
  email: string;
  name?: string;
  invitationCode: string;
  joinedAt: Date;
  lastActiveAt?: Date;
  testingExperience: 'beginner' | 'intermediate' | 'expert';
  focusAreas: string[];
  timezone: string;
  availability: string;
  communicationPreferences: {
    email: boolean;
    slack: boolean;
    weeklyMeetings: boolean;
  };
  contributionScore: number;
  status: 'active' | 'inactive' | 'completed';
}

export class AlphaTestingFeedbackService {
  private prisma: PrismaClient;
  private emailTransporter: nodemailer.Transporter;

  constructor() {
    this.prisma = new PrismaClient();
    this.initializeEmailTransporter();
  }

  private initializeEmailTransporter(): void {
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }

  /**
   * Submit a bug report
   */
  async submitBugReport(bugReport: Omit<BugReport, 'id' | 'status' | 'priority'>): Promise<string> {
    try {
      const bugId = this.generateBugId();
      const priority = this.calculateBugPriority(bugReport.severity, bugReport.category);

      const savedBug = await this.prisma.bugReport.create({
        data: {
          id: bugId,
          testerId: bugReport.testerId,
          title: bugReport.title,
          description: bugReport.description,
          severity: bugReport.severity,
          category: bugReport.category,
          stepsToReproduce: JSON.stringify(bugReport.stepsToReproduce),
          expectedBehavior: bugReport.expectedBehavior,
          actualBehavior: bugReport.actualBehavior,
          environment: JSON.stringify(bugReport.environment),
          attachments: JSON.stringify(bugReport.attachments || []),
          consoleErrors: JSON.stringify(bugReport.consoleErrors || []),
          status: 'open',
          priority,
          tags: JSON.stringify(bugReport.tags || []),
          metadata: JSON.stringify(bugReport.metadata || {}),
          createdAt: new Date()
        }
      });

      // Log the bug report
      productionLogger.info('Bug report submitted', {
        bugId,
        testerId: bugReport.testerId,
        severity: bugReport.severity,
        category: bugReport.category
      });

      // Audit log
      await auditService.logAuditEvent({
        userId: bugReport.testerId,
        action: 'bug_report_submitted',
        resource: 'alpha_testing',
        resourceId: bugId,
        outcome: 'success',
        details: {
          severity: bugReport.severity,
          category: bugReport.category,
          title: bugReport.title
        },
        severity: 'medium',
        category: 'data_modification'
      });

      // Send notification for critical/high severity bugs
      if (bugReport.severity === 'critical' || bugReport.severity === 'high') {
        await this.notifyDevelopmentTeam(savedBug);
      }

      // Update tester contribution score
      await this.updateTesterScore(bugReport.testerId, 'bug_report', bugReport.severity);

      return bugId;
    } catch (error) {
      productionLogger.error('Failed to submit bug report', error as Error, {
        testerId: bugReport.testerId,
        title: bugReport.title
      });
      throw error;
    }
  }

  /**
   * Submit a feature request
   */
  async submitFeatureRequest(featureRequest: Omit<FeatureRequest, 'id' | 'status' | 'votes' | 'comments'>): Promise<string> {
    try {
      const requestId = this.generateFeatureRequestId();

      const savedRequest = await this.prisma.featureRequest.create({
        data: {
          id: requestId,
          testerId: featureRequest.testerId,
          title: featureRequest.title,
          description: featureRequest.description,
          useCase: featureRequest.useCase,
          proposedSolution: featureRequest.proposedSolution,
          alternativeSolutions: JSON.stringify(featureRequest.alternativeSolutions || []),
          priority: featureRequest.priority,
          category: featureRequest.category,
          businessValue: featureRequest.businessValue,
          technicalComplexity: featureRequest.technicalComplexity,
          status: 'submitted',
          votes: 0,
          metadata: JSON.stringify(featureRequest.metadata || {}),
          createdAt: new Date()
        }
      });

      productionLogger.info('Feature request submitted', {
        requestId,
        testerId: featureRequest.testerId,
        priority: featureRequest.priority,
        category: featureRequest.category
      });

      await auditService.logAuditEvent({
        userId: featureRequest.testerId,
        action: 'feature_request_submitted',
        resource: 'alpha_testing',
        resourceId: requestId,
        outcome: 'success',
        details: {
          priority: featureRequest.priority,
          category: featureRequest.category,
          title: featureRequest.title
        },
        severity: 'low',
        category: 'data_modification'
      });

      await this.updateTesterScore(featureRequest.testerId, 'feature_request', featureRequest.priority);

      return requestId;
    } catch (error) {
      productionLogger.error('Failed to submit feature request', error as Error, {
        testerId: featureRequest.testerId,
        title: featureRequest.title
      });
      throw error;
    }
  }

  /**
   * Submit general feedback
   */
  async submitGeneralFeedback(feedback: Omit<GeneralFeedback, 'id'>): Promise<string> {
    try {
      const feedbackId = this.generateFeedbackId();

      await this.prisma.generalFeedback.create({
        data: {
          id: feedbackId,
          testerId: feedback.testerId,
          category: feedback.category,
          rating: feedback.rating,
          feedback: feedback.feedback,
          suggestions: feedback.suggestions,
          wouldRecommend: feedback.wouldRecommend,
          mostUsefulFeature: feedback.mostUsefulFeature,
          leastUsefulFeature: feedback.leastUsefulFeature,
          missingFeatures: JSON.stringify(feedback.missingFeatures || []),
          metadata: JSON.stringify(feedback.metadata || {}),
          createdAt: new Date()
        }
      });

      productionLogger.info('General feedback submitted', {
        feedbackId,
        testerId: feedback.testerId,
        category: feedback.category,
        rating: feedback.rating
      });

      await this.updateTesterScore(feedback.testerId, 'general_feedback', feedback.rating);

      return feedbackId;
    } catch (error) {
      productionLogger.error('Failed to submit general feedback', error as Error, {
        testerId: feedback.testerId,
        category: feedback.category
      });
      throw error;
    }
  }

  /**
   * Start a testing session
   */
  async startTestingSession(session: Omit<TestingSession, 'id' | 'endTime' | 'duration'>): Promise<string> {
    try {
      const sessionId = this.generateSessionId();

      await this.prisma.testingSession.create({
        data: {
          id: sessionId,
          testerId: session.testerId,
          sessionType: session.sessionType,
          scenario: session.scenario,
          startTime: session.startTime,
          tasksCompleted: JSON.stringify(session.tasksCompleted),
          tasksSkipped: JSON.stringify(session.tasksSkipped),
          issuesEncountered: JSON.stringify(session.issuesEncountered),
          overallRating: session.overallRating,
          notes: session.notes,
          metadata: JSON.stringify(session.metadata || {})
        }
      });

      productionLogger.info('Testing session started', {
        sessionId,
        testerId: session.testerId,
        sessionType: session.sessionType
      });

      return sessionId;
    } catch (error) {
      productionLogger.error('Failed to start testing session', error as Error, {
        testerId: session.testerId,
        sessionType: session.sessionType
      });
      throw error;
    }
  }

  /**
   * End a testing session
   */
  async endTestingSession(sessionId: string, endData: {
    tasksCompleted: string[];
    tasksSkipped: string[];
    issuesEncountered: string[];
    overallRating: number;
    notes?: string;
  }): Promise<void> {
    try {
      const session = await this.prisma.testingSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        throw new Error('Testing session not found');
      }

      const endTime = new Date();
      const duration = endTime.getTime() - session.startTime.getTime();

      await this.prisma.testingSession.update({
        where: { id: sessionId },
        data: {
          endTime,
          duration,
          tasksCompleted: JSON.stringify(endData.tasksCompleted),
          tasksSkipped: JSON.stringify(endData.tasksSkipped),
          issuesEncountered: JSON.stringify(endData.issuesEncountered),
          overallRating: endData.overallRating,
          notes: endData.notes
        }
      });

      productionLogger.info('Testing session ended', {
        sessionId,
        testerId: session.testerId,
        duration: Math.round(duration / 1000 / 60), // minutes
        rating: endData.overallRating
      });

      await this.updateTesterScore(session.testerId, 'testing_session', endData.overallRating);
    } catch (error) {
      productionLogger.error('Failed to end testing session', error as Error, { sessionId });
      throw error;
    }
  }

  /**
   * Vote on a feature request
   */
  async voteOnFeatureRequest(requestId: string, testerId: string, vote: 'up' | 'down'): Promise<void> {
    try {
      // Check if user already voted
      const existingVote = await this.prisma.featureVote.findUnique({
        where: {
          requestId_testerId: {
            requestId,
            testerId
          }
        }
      });

      if (existingVote) {
        // Update existing vote
        await this.prisma.featureVote.update({
          where: { id: existingVote.id },
          data: { vote }
        });
      } else {
        // Create new vote
        await this.prisma.featureVote.create({
          data: {
            requestId,
            testerId,
            vote
          }
        });
      }

      // Update vote count on feature request
      const voteCount = await this.prisma.featureVote.count({
        where: {
          requestId,
          vote: 'up'
        }
      });

      await this.prisma.featureRequest.update({
        where: { id: requestId },
        data: { votes: voteCount }
      });

      productionLogger.info('Feature request vote recorded', {
        requestId,
        testerId,
        vote,
        newVoteCount: voteCount
      });
    } catch (error) {
      productionLogger.error('Failed to record feature vote', error as Error, {
        requestId,
        testerId,
        vote
      });
      throw error;
    }
  }

  /**
   * Get bug reports with filtering and pagination
   */
  async getBugReports(filters: {
    testerId?: string;
    severity?: string;
    category?: string;
    status?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ reports: BugReport[]; total: number }> {
    try {
      const whereClause: any = {};
      
      if (filters.testerId) whereClause.testerId = filters.testerId;
      if (filters.severity) whereClause.severity = filters.severity;
      if (filters.category) whereClause.category = filters.category;
      if (filters.status) whereClause.status = filters.status;
      if (filters.priority) whereClause.priority = filters.priority;

      const [reports, total] = await Promise.all([
        this.prisma.bugReport.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: filters.limit || 50,
          skip: filters.offset || 0
        }),
        this.prisma.bugReport.count({ where: whereClause })
      ]);

      return {
        reports: reports.map(this.formatBugReport),
        total
      };
    } catch (error) {
      productionLogger.error('Failed to get bug reports', error as Error, { filters });
      throw error;
    }
  }

  /**
   * Get feature requests with filtering and pagination
   */
  async getFeatureRequests(filters: {
    testerId?: string;
    category?: string;
    status?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ requests: FeatureRequest[]; total: number }> {
    try {
      const whereClause: any = {};
      
      if (filters.testerId) whereClause.testerId = filters.testerId;
      if (filters.category) whereClause.category = filters.category;
      if (filters.status) whereClause.status = filters.status;
      if (filters.priority) whereClause.priority = filters.priority;

      const [requests, total] = await Promise.all([
        this.prisma.featureRequest.findMany({
          where: whereClause,
          orderBy: { votes: 'desc' },
          take: filters.limit || 50,
          skip: filters.offset || 0
        }),
        this.prisma.featureRequest.count({ where: whereClause })
      ]);

      return {
        requests: requests.map(this.formatFeatureRequest),
        total
      };
    } catch (error) {
      productionLogger.error('Failed to get feature requests', error as Error, { filters });
      throw error;
    }
  }

  /**
   * Generate analytics report for alpha testing
   */
  async generateAnalyticsReport(startDate: Date, endDate: Date): Promise<any> {
    try {
      const [
        bugStats,
        featureStats,
        feedbackStats,
        sessionStats,
        testerStats
      ] = await Promise.all([
        this.getBugStatistics(startDate, endDate),
        this.getFeatureStatistics(startDate, endDate),
        this.getFeedbackStatistics(startDate, endDate),
        this.getSessionStatistics(startDate, endDate),
        this.getTesterStatistics()
      ]);

      return {
        period: { startDate, endDate },
        bugs: bugStats,
        features: featureStats,
        feedback: feedbackStats,
        sessions: sessionStats,
        testers: testerStats,
        generatedAt: new Date()
      };
    } catch (error) {
      productionLogger.error('Failed to generate analytics report', error as Error);
      throw error;
    }
  }

  /**
   * Update tester contribution score
   */
  private async updateTesterScore(testerId: string, action: string, value: any): Promise<void> {
    const scoreMap = {
      bug_report: {
        critical: 10,
        high: 7,
        medium: 5,
        low: 3
      },
      feature_request: {
        high: 5,
        medium: 3,
        low: 2
      },
      general_feedback: (rating: number) => Math.max(1, Math.floor(rating / 2)),
      testing_session: (rating: number) => Math.max(1, Math.floor(rating / 2))
    };

    let points = 0;
    if (action === 'bug_report') {
      points = scoreMap.bug_report[value as keyof typeof scoreMap.bug_report] || 1;
    } else if (action === 'feature_request') {
      points = scoreMap.feature_request[value as keyof typeof scoreMap.feature_request] || 1;
    } else if (action === 'general_feedback' || action === 'testing_session') {
      points = scoreMap[action](value);
    }

    await this.prisma.alphaTester.update({
      where: { id: testerId },
      data: {
        contributionScore: {
          increment: points
        },
        lastActiveAt: new Date()
      }
    });
  }

  private async getBugStatistics(startDate: Date, endDate: Date): Promise<any> {
    // Implementation for bug statistics
    return {};
  }

  private async getFeatureStatistics(startDate: Date, endDate: Date): Promise<any> {
    // Implementation for feature statistics
    return {};
  }

  private async getFeedbackStatistics(startDate: Date, endDate: Date): Promise<any> {
    // Implementation for feedback statistics
    return {};
  }

  private async getSessionStatistics(startDate: Date, endDate: Date): Promise<any> {
    // Implementation for session statistics
    return {};
  }

  private async getTesterStatistics(): Promise<any> {
    // Implementation for tester statistics
    return {};
  }

  private formatBugReport(report: any): BugReport {
    return {
      ...report,
      stepsToReproduce: JSON.parse(report.stepsToReproduce),
      environment: JSON.parse(report.environment),
      attachments: JSON.parse(report.attachments || '[]'),
      consoleErrors: JSON.parse(report.consoleErrors || '[]'),
      tags: JSON.parse(report.tags || '[]'),
      metadata: JSON.parse(report.metadata || '{}')
    };
  }

  private formatFeatureRequest(request: any): FeatureRequest {
    return {
      ...request,
      alternativeSolutions: JSON.parse(request.alternativeSolutions || '[]'),
      metadata: JSON.parse(request.metadata || '{}'),
      comments: [] // Would be loaded separately if needed
    };
  }

  private generateBugId(): string {
    return `BUG-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private generateFeatureRequestId(): string {
    return `FR-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private generateFeedbackId(): string {
    return `FB-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private generateSessionId(): string {
    return `TS-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private calculateBugPriority(severity: string, category: string): 'p1' | 'p2' | 'p3' | 'p4' {
    if (severity === 'critical') return 'p1';
    if (severity === 'high') return 'p2';
    if (severity === 'medium') return 'p3';
    return 'p4';
  }

  private async notifyDevelopmentTeam(bugReport: any): Promise<void> {
    try {
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@yourdomain.com',
        to: process.env.DEV_TEAM_EMAIL || 'dev-team@yourdomain.com',
        subject: `[ALPHA] ${bugReport.severity.toUpperCase()} Bug Report: ${bugReport.title}`,
        html: `
          <h2>New ${bugReport.severity} Severity Bug Report</h2>
          <p><strong>Bug ID:</strong> ${bugReport.id}</p>
          <p><strong>Title:</strong> ${bugReport.title}</p>
          <p><strong>Category:</strong> ${bugReport.category}</p>
          <p><strong>Severity:</strong> ${bugReport.severity}</p>
          <p><strong>Description:</strong></p>
          <p>${bugReport.description}</p>
          <p><strong>View Details:</strong> <a href="${process.env.ADMIN_URL}/bugs/${bugReport.id}">Click here</a></p>
        `
      });
    } catch (error) {
      productionLogger.error('Failed to send bug notification email', error as Error);
    }
  }
}

export const alphaTestingFeedback = new AlphaTestingFeedbackService();