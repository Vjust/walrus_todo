import { Router } from 'express';
import { AIController } from '../controllers/aiController';
import { WebSocketService } from '../services/websocketService';
import { TodoService } from '../services/todoService';
import {
  validateAISuggestionRequest,
  validateAISummarizeRequest,
  validateAICategorizeRequest,
  validateAIPrioritizeRequest,
  validateAIAnalyzeRequest,
} from '../middleware/validation';

export function createAIRoutes(websocketService?: WebSocketService): Router {
  const router = Router();
  const todoService = new TodoService();
  const aiController = new AIController(todoService);

  /**
   * @route   POST /api/v1/ai/suggest
   * @desc    Get AI-powered task suggestions
   * @access  Private (requires wallet)
   */
  router.post('/suggest', validateAISuggestionRequest, aiController.suggest);

  /**
   * @route   POST /api/v1/ai/summarize
   * @desc    Get AI summary of todo list
   * @access  Private (requires wallet)
   */
  router.post('/summarize', validateAISummarizeRequest, aiController.summarize);

  /**
   * @route   POST /api/v1/ai/categorize
   * @desc    Get AI-suggested categories and tags
   * @access  Private (requires wallet)
   */
  router.post('/categorize', validateAICategorizeRequest, aiController.categorize);

  /**
   * @route   POST /api/v1/ai/prioritize
   * @desc    Get AI-suggested priority levels
   * @access  Private (requires wallet)
   */
  router.post('/prioritize', validateAIPrioritizeRequest, aiController.prioritize);

  /**
   * @route   POST /api/v1/ai/analyze
   * @desc    Get AI productivity analysis
   * @access  Private (requires wallet)
   */
  router.post('/analyze', validateAIAnalyzeRequest, aiController.analyze);

  return router;
}