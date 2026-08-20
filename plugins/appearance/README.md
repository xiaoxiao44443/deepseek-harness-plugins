# DFY DSH Appearance

Adds an **外观** page to the Harness settings sidebar. It preserves every visible
Assistant text output and collapses the context/reasoning/tool segment immediately
before that output behind its own disclosure. It also adjusts the chat font size and line-height ratio
without changing the sidebar, settings UI, editor, or persisted transcript.

The process-group adapter uses the public `conversation.chat.turnTail` slot and
the stable `data-chat-flow-kind` attributes emitted by DSH rc.8. It never edits
conversation data; disabling or unloading the plugin removes every DOM marker.
Media tool rows belong to the same per-output segment, so screenshots and visual
analysis collapse with the process that produced the following text and return in
their original position when that segment is expanded.
