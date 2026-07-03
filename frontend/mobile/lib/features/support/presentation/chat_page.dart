import 'package:flutter/material.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_theme.dart';

class _ChatMessage {
  final String text;
  final bool fromUser;

  const _ChatMessage(this.text, this.fromUser);
}

/// Simple support chat. The header shows the expected response time so
/// nobody is left guessing (SUP-06 preview, uncertainty principle).
/// Ticketing with photos arrives in Sprint 5.
class ChatPage extends StatefulWidget {
  const ChatPage({super.key});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();

  final List<_ChatMessage> _messages = [
    const _ChatMessage(
      'Namaste! You have reached Bike Buddy support. How can we help you today?',
      false,
    ),
  ];

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _send() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    setState(() {
      _messages.add(_ChatMessage(text, true));
      _messages.add(const _ChatMessage(
        'Thanks for the message! A support agent will reply here within about 5 minutes. '
        'If it is urgent, call us any time.',
        false,
      ));
      _controller.clear();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Support Chat'),
            Text(
              'Avg response: 5 min · Online 24/7',
              style: TextStyle(fontSize: 12, color: AppColors.success),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.all(AppSpacing.md),
                itemCount: _messages.length,
                itemBuilder: (context, index) {
                  final message = _messages[index];
                  return Align(
                    alignment: message.fromUser
                        ? Alignment.centerRight
                        : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                      padding: const EdgeInsets.all(AppSpacing.md),
                      constraints: BoxConstraints(
                        maxWidth: MediaQuery.of(context).size.width * 0.75,
                      ),
                      decoration: BoxDecoration(
                        color: message.fromUser
                            ? AppColors.primary
                            : AppColors.surface,
                        borderRadius: BorderRadius.circular(AppRadius.medium),
                      ),
                      child: Text(
                        message.text,
                        style: TextStyle(
                          color: message.fromUser
                              ? Colors.white
                              : AppColors.textPrimary,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _send(),
                      decoration: const InputDecoration(
                        hintText: 'Type your message...',
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  SizedBox(
                    width: 48,
                    height: 48,
                    child: IconButton.filled(
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.primary,
                      ),
                      onPressed: _send,
                      icon: const Icon(Icons.send, color: Colors.white),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
