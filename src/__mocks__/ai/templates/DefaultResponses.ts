/**
 * DefaultResponses - Default mock response templates for AI operations
 * 
 * These templates provide realistic mock responses for each AI operation
 * and can be customized or replaced for specific test scenarios.
 */

import { MockResponseTemplate } from '../types';

/**
 * Default mock responses for different operations
 */
export const DefaultMockResponses: Record<string, MockResponseTemplate> = {
  /* Summarize operation */
  summarize: {
    text: "This task list is focused on project work with several items requiring immediate attention. There are multiple high-priority tasks related to documentation updates and client presentations. Most tasks appear to be part of ongoing project development with deadlines approaching soon.",
    patterns: [
      {
        match: /work|project|task/i,
        text: "The task list contains multiple work-related items across different priority levels. The highest priority items involve project deliverables and client-facing tasks, while ongoing maintenance items are at lower priority. Several tasks require collaboration with team members."
      },
      {
        match: /personal|home|family/i,
        text: "These personal tasks focus primarily on home organization, errands, and family commitments. There are a few high-priority items related to upcoming events and appointments. The remaining tasks are everyday responsibilities and ongoing maintenance items."
      },
      {
        match: /deadline|urgent|important/i,
        text: "There are multiple urgent tasks with impending deadlines that require immediate attention. The most critical items involve project deliverables due in the next 24-48 hours. Several tasks are blocking other work and should be prioritized to prevent workflow disruptions."
      }
    ]
  },
  
  /* Categorize operation */
  categorize: {
    structured: {
      "Work": ["todo-1", "todo-3", "todo-5"],
      "Personal": ["todo-2", "todo-4"],
      "Urgent": ["todo-1", "todo-2"]
    },
    patterns: [
      {
        match: /project|deadline|client/i,
        structured: {
          "Project Work": ["todo-1", "todo-3"],
          "Client Meetings": ["todo-2"],
          "Documentation": ["todo-4", "todo-5"],
          "Urgent": ["todo-1", "todo-2"]
        }
      },
      {
        match: /home|family|personal/i,
        structured: {
          "Home": ["todo-1", "todo-4"],
          "Family": ["todo-2"],
          "Errands": ["todo-3", "todo-5"],
          "Health": ["todo-6"]
        }
      }
    ]
  },
  
  /* Prioritize operation */
  prioritize: {
    structured: {
      "todo-1": 9,
      "todo-2": 7,
      "todo-3": 5,
      "todo-4": 3,
      "todo-5": 2
    },
    patterns: [
      {
        match: /urgent|critical/i,
        structured: {
          "todo-1": 10,
          "todo-2": 9,
          "todo-3": 8,
          "todo-4": 6,
          "todo-5": 4
        }
      },
      {
        match: /low|routine/i,
        structured: {
          "todo-1": 5,
          "todo-2": 4,
          "todo-3": 3,
          "todo-4": 2,
          "todo-5": 1
        }
      }
    ]
  },
  
  /* Suggest operation */
  suggest: {
    structured: [
      "Schedule team review meeting",
      "Update project documentation",
      "Prepare client presentation slides",
      "Review budget proposal",
      "Send progress report to stakeholders"
    ],
    patterns: [
      {
        match: /project|development|code/i,
        structured: [
          "Create unit tests for new features",
          "Address code review feedback",
          "Update API documentation",
          "Refactor database queries for better performance",
          "Set up monitoring for new services"
        ]
      },
      {
        match: /meeting|client|presentation/i,
        structured: [
          "Prepare presentation slides",
          "Gather project metrics for report",
          "Create meeting agenda",
          "Schedule follow-up calls",
          "Draft executive summary"
        ]
      },
      {
        match: /personal|home|family/i,
        structured: [
          "Schedule annual medical check-up",
          "Renew subscription services",
          "Plan weekly meal prep",
          "Research vacation options",
          "Update home inventory"
        ]
      }
    ]
  },
  
  /* Analyze operation */
  analyze: {
    structured: {
      "themes": [
        "Project management",
        "Documentation",
        "Client communications"
      ],
      "bottlenecks": [
        "Waiting on client approvals",
        "Technical documentation is incomplete",
        "Resource constraints for deployment"
      ],
      "timeEstimates": {
        "total": "3-4 days",
        "breakdown": {
          "high-priority": "1-2 days",
          "medium-priority": "1-2 days",
          "low-priority": "1 day"
        }
      },
      "suggestedWorkflow": [
        "Address high-priority blockers first",
        "Group similar tasks for efficiency",
        "Schedule focused time for documentation",
        "Delegate routine maintenance tasks",
        "Set up daily progress check-ins"
      ]
    },
    patterns: [
      {
        match: /project|development|technical/i,
        structured: {
          "themes": [
            "Technical development",
            "System architecture",
            "Testing and quality assurance"
          ],
          "bottlenecks": [
            "Integration testing is incomplete",
            "Test environment issues",
            "Dependency on external services"
          ],
          "timeEstimates": {
            "total": "5-7 days",
            "breakdown": {
              "development": "2-3 days",
              "testing": "2-3 days",
              "deployment": "1 day"
            }
          },
          "suggestedWorkflow": [
            "Address critical bugs first",
            "Complete feature development",
            "Run comprehensive test suite",
            "Prepare deployment documentation",
            "Stage deployment in test environment"
          ]
        }
      },
      {
        match: /personal|home|family/i,
        structured: {
          "themes": [
            "Home organization",
            "Personal well-being",
            "Family activities"
          ],
          "bottlenecks": [
            "Time constraints due to work schedule",
            "Waiting on others' availability",
            "Budget limitations"
          ],
          "timeEstimates": {
            "total": "1-2 weeks",
            "breakdown": {
              "urgent": "1-2 days",
              "important": "3-5 days",
              "routine": "ongoing"
            }
          },
          "suggestedWorkflow": [
            "Handle time-sensitive appointments first",
            "Batch errands by location",
            "Schedule regular maintenance tasks",
            "Delegate shared responsibilities",
            "Plan relaxation time"
          ]
        }
      }
    ]
  },
  
  /* Default operation as fallback */
  default: {
    text: "Default mock response for unknown operation type",
    structured: {
      "result": "Default structured response",
      "operation": "unknown",
      "status": "success"
    }
  }
};