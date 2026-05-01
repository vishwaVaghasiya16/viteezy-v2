"""
Viteezy Chatbot Demo UI
A comprehensive Streamlit interface for testing and demonstrating the Viteezy chatbot API.
"""
import os
from typing import Any

import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

DEFAULT_API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")

# Page config
st.set_page_config(
    page_title="Viteezy Chatbot Demo",
    page_icon="💊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better styling
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        color: #1f77b4;
        text-align: center;
        margin-bottom: 1rem;
    }
    .metric-card {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 0.5rem;
        margin: 0.5rem 0;
    }
    .stButton>button {
        width: 100%;
    }
    .session-info {
        background-color: #e8f4f8;
        padding: 1rem;
        border-radius: 0.5rem;
        margin: 1rem 0;
    }
</style>
""", unsafe_allow_html=True)


def create_session(api_base: str, user_id: str | None = None) -> str:
    """Create a new chat session."""
    payload = {}
    if user_id:
        payload["user_id"] = user_id
    resp = requests.post(f"{api_base}/sessions", json=payload, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    # Handle new standardized response format
    if isinstance(data, dict) and "data" in data:
        return data["data"]["session_id"]
    # Fallback for old format
    return data.get("session_id") or data.get("data", {}).get("session_id", "")


def get_session_info(api_base: str, session_id: str) -> dict | None:
    """Get session information including token usage."""
    try:
        resp = requests.get(f"{api_base}/sessions/{session_id}", timeout=10)
        resp.raise_for_status()
        data = resp.json()
        # Handle new standardized response format
        if isinstance(data, dict) and "data" in data:
            return data["data"]
        # Fallback for old format
        return data
    except Exception:
        return None


def send_message(
    api_base: str, 
    session_id: str, 
    message: str, 
    context: dict | None = None
) -> tuple[str, str | None, dict | None]:
    """
    Send a message to the chat bot.
    Returns (reply_content, redirect_url, options).
    """
    payload: dict[str, Any] = {"session_id": session_id, "message": message}
    if context:
        payload["context"] = context
    resp = requests.post(f"{api_base}/chat", json=payload, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    
    # Handle new standardized response format
    if isinstance(data, dict) and "data" in data:
        chat_response = data["data"]
        reply_content = chat_response.get("reply", {}).get("content", "")
        redirect_url = chat_response.get("redirect_url")
        options = chat_response.get("options")
        return reply_content, redirect_url, options
    
    # Fallback for old format
    reply_content = data.get("reply", {}).get("content", "") if isinstance(data.get("reply"), dict) else ""
    redirect_url = data.get("redirect_url")
    options = data.get("options")
    return reply_content, redirect_url, options


def check_user_login(api_base: str, user_id: str) -> dict:
    """Check if user exists in the system."""
    try:
        resp = requests.get(
            f"{api_base}/useridLogin",
            params={"user_id": user_id},
            timeout=10
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        return {"status": "error", "message": str(e)}


def main() -> None:
    """Main Streamlit application."""
    
    # Header
    st.markdown('<div class="main-header">💊 Viteezy Chatbot Demo</div>', unsafe_allow_html=True)
    st.caption("Interactive demo of the Viteezy supplement recommendation chatbot")
    
    # Sidebar for configuration
    with st.sidebar:
        st.header("⚙️ Configuration")
        
        api_base = st.text_input(
            "API Base URL",
            value=DEFAULT_API_BASE,
            help="Base URL for the API (e.g., http://localhost:8000/api/v1)"
        )
        
        st.divider()
        
        st.header("👤 User Management")
        user_id = st.text_input(
            "User ID (ObjectId)",
            placeholder="6943938d79e5f9197e82e33a",
            help="Optional: User ID to link session to existing user"
        )
        
        if user_id and st.button("Check User", use_container_width=True):
            with st.spinner("Checking user..."):
                result = check_user_login(api_base, user_id)
                if result.get("status") == "success" and result.get("isLogin"):
                    st.success("✅ User exists and is logged in")
                    st.json(result)
                else:
                    st.warning("⚠️ User not found or not logged in")
                    if result.get("message"):
                        st.info(result["message"])
                    st.json(result)
        
        st.divider()
        
        st.header("📊 Session Management")
        
        if st.button("🆕 Create New Session", type="primary", use_container_width=True):
            try:
                user_id_value = user_id.strip() if user_id else None
                with st.spinner("Creating session..."):
                    session_id = create_session(api_base, user_id=user_id_value)
                    st.session_state.session_id = session_id
                    st.session_state.messages = []
                    st.session_state.is_logged_in = False
                    st.session_state.options = None
                    st.success(f"✅ Session created: `{session_id[:20]}...`")
                    st.rerun()
            except Exception as exc:
                st.error(f"❌ Failed to create session: {exc}")
        
        if st.button("🔄 Reset Conversation", use_container_width=True):
            st.session_state.session_id = None
            st.session_state.messages = []
            st.session_state.is_logged_in = False
            st.session_state.options = None
            st.rerun()
        
        # Session info display
        if st.session_state.get("session_id"):
            st.divider()
            st.header("📋 Session Info")
            st.code(st.session_state.session_id, language=None)
            
            # Fetch and display token usage
            if st.button("📊 Refresh Token Usage", use_container_width=True):
                session_info = get_session_info(api_base, st.session_state.session_id)
                if session_info:
                    # Handle both new and old format
                    metadata = session_info.get("metadata", {}) if isinstance(session_info, dict) else {}
                    token_usage = metadata.get("token_usage", {}) if isinstance(metadata, dict) else {}
                    if token_usage:
                        st.session_state.token_usage = token_usage
                        st.rerun()
    
    # Initialize session state
    if "session_id" not in st.session_state:
        st.session_state.session_id = None
    if "messages" not in st.session_state:
        st.session_state.messages = []
    if "is_logged_in" not in st.session_state:
        st.session_state.is_logged_in = False
    if "options" not in st.session_state:
        st.session_state.options = None
    if "token_usage" not in st.session_state:
        st.session_state.token_usage = None
    
    # Main content area
    col1, col2 = st.columns([2, 1])
    
    with col1:
        # Context input (collapsible)
        with st.expander("📝 Optional Context (Quiz/Profile Data)", expanded=False):
            context_health_goals = st.text_input(
                "Health Goals (comma separated)",
                placeholder="Bone Health, Immune Support, Sleep",
                help="Enter health goals that will be passed as context"
            )
            context = None
            if context_health_goals.strip():
                goals = [goal.strip() for goal in context_health_goals.split(",") if goal.strip()]
                if goals:
                    context = {"healthGoals": goals}
        
        st.divider()
        
        # Chat interface
        if st.session_state.session_id:
            # Display messages
            for msg_idx, (role, content, options) in enumerate(st.session_state.messages):
                with st.chat_message(role):
                    st.write(content)
                    if options and role == "assistant":
                        st.caption("Available options:")
                        for opt_idx, opt in enumerate(options):
                            st.button(
                                f"📌 {opt.get('label', opt.get('value', ''))}",
                                key=f"option_{opt.get('value', '')}_{msg_idx}_{opt_idx}",
                                disabled=True,
                                use_container_width=True
                            )
            
            # Show login button if not logged in
            if not st.session_state.is_logged_in:
                if st.button("🔐 Mark as Logged In", type="primary", use_container_width=True):
                    st.info("ℹ️ Login functionality has been updated. Please use the /useridLogin endpoint.")
            
            # Chat input
            user_input = st.chat_input("Type your message here...")
            if user_input:
                st.session_state.messages.append(("user", user_input, None))
                with st.chat_message("user"):
                    st.write(user_input)
                
                try:
                    with st.spinner("🤔 Thinking..."):
                        reply, redirect_url, options = send_message(
                            api_base, 
                            st.session_state.session_id, 
                            user_input, 
                            context
                        )
                        st.session_state.messages.append(("assistant", reply, options))
                        st.session_state.options = options
                        
                        with st.chat_message("assistant"):
                            st.write(reply)
                            
                            # Display options if available
                            if options:
                                st.caption("💡 Select an option:")
                                option_cols = st.columns(min(len(options), 3))
                                current_msg_count = len(st.session_state.messages)
                                timestamp = id(options)  # Use object id for uniqueness
                                for idx, opt in enumerate(options):
                                    with option_cols[idx % len(option_cols)]:
                                        if st.button(
                                            opt.get("label", opt.get("value", "")),
                                            key=f"select_option_{current_msg_count}_{idx}_{timestamp}_{opt.get('value', '').replace(' ', '_')}",
                                            use_container_width=True
                                        ):
                                            # Send selected option as message
                                            st.session_state.messages.append(("user", opt.get("value", ""), None))
                                            st.rerun()
                            
                            # Show redirect link if provided
                            if redirect_url:
                                st.info(f"🔗 Registration required: [Click here to register]({redirect_url})")
                                st.info("After registering, you can continue the conversation.")
                    
                    # Refresh token usage after message
                    session_info = get_session_info(api_base, st.session_state.session_id)
                    if session_info:
                        # Handle both new and old format
                        metadata = session_info.get("metadata", {}) if isinstance(session_info, dict) else {}
                        token_usage = metadata.get("token_usage", {}) if isinstance(metadata, dict) else {}
                        if token_usage:
                            st.session_state.token_usage = token_usage
                    
                    st.rerun()
                except Exception as exc:
                    st.error(f"❌ Failed to send message: {exc}")
                    st.exception(exc)
        else:
            st.info("👆 Create a session using the sidebar to start chatting.")
            st.markdown("""
            ### 🚀 Getting Started
            
            1. **Configure API**: Set the API base URL in the sidebar (default: http://localhost:8000/api/v1)
            2. **Create Session**: Click "Create New Session" in the sidebar
            3. **Start Chatting**: Type your message in the chat input below
            4. **Monitor Usage**: Check token usage and costs in the right panel
            
            ### 📋 Features
            
            - ✅ Full conversation history
            - ✅ Option-based questions
            - ✅ Token usage tracking
            - ✅ Cost calculation
            - ✅ Session management
            - ✅ User login integration
            """)
    
    with col2:
        st.header("📊 Analytics & Usage")
        
        if st.session_state.session_id:
            # Token usage display
            if st.session_state.token_usage:
                usage = st.session_state.token_usage
                
                st.subheader("💰 Token Usage")
                
                col_a, col_b = st.columns(2)
                with col_a:
                    st.metric("Input Tokens", f"{usage.get('input_tokens', 0):,}")
                    st.metric("Output Tokens", f"{usage.get('output_tokens', 0):,}")
                with col_b:
                    st.metric("Total Tokens", f"{usage.get('total_tokens', 0):,}")
                    st.metric("Cost", f"${usage.get('cost', 0.0):.6f}")
                
                st.caption(f"Model: {usage.get('model', 'unknown')}")
                st.caption(f"API Calls: {usage.get('api_calls', 0)}")
                
                if usage.get('last_updated'):
                    st.caption(f"Last Updated: {usage.get('last_updated', 'N/A')}")
                
                st.divider()
                
                # Cost breakdown
                if usage.get('total_tokens', 0) > 0:
                    input_pct = (usage.get('input_tokens', 0) / usage.get('total_tokens', 1)) * 100
                    output_pct = (usage.get('output_tokens', 0) / usage.get('total_tokens', 1)) * 100
                    
                    st.subheader("📈 Token Distribution")
                    st.progress(input_pct / 100, text=f"Input: {input_pct:.1f}%")
                    st.progress(output_pct / 100, text=f"Output: {output_pct:.1f}%")
            else:
                st.info("📊 Token usage will appear here after sending messages.")
                if st.button("🔄 Load Token Usage", use_container_width=True):
                    session_info = get_session_info(api_base, st.session_state.session_id)
                    if session_info:
                        # Handle both new and old format
                        metadata = session_info.get("metadata", {}) if isinstance(session_info, dict) else {}
                        token_usage = metadata.get("token_usage", {}) if isinstance(metadata, dict) else {}
                        if token_usage:
                            st.session_state.token_usage = token_usage
                            st.rerun()
            
            st.divider()
            
            # Message statistics
            st.subheader("💬 Conversation Stats")
            user_messages = sum(1 for msg in st.session_state.messages if msg[0] == "user")
            assistant_messages = sum(1 for msg in st.session_state.messages if msg[0] == "assistant")
            
            col_c, col_d = st.columns(2)
            with col_c:
                st.metric("User Messages", user_messages)
            with col_d:
                st.metric("Bot Responses", assistant_messages)
            
            st.metric("Total Messages", len(st.session_state.messages))
        else:
            st.info("📊 Analytics will appear here after creating a session.")
            st.markdown("""
            ### 📊 What's Tracked
            
            - **Input Tokens**: Tokens in prompts sent to OpenAI
            - **Output Tokens**: Tokens in responses from OpenAI
            - **Total Tokens**: Sum of input and output tokens
            - **Cost**: Calculated based on model pricing
            - **API Calls**: Number of OpenAI API calls made
            
            ### 💡 Tips
            
            - Token usage is accumulated across all messages in a session
            - Costs are calculated using current OpenAI pricing
            - Refresh token usage manually or it updates automatically after each message
            """)


if __name__ == "__main__":
    main()
