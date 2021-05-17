import React, { useEffect, useState, useCallback, useRef } from 'react';

import css from './ChannelChat.module.css';

import useAuth from '../../../hooks/auth/useAuth';
import firebase from 'firebase/app';
import 'firebase/database';
import useFirebaseDataListener from '../../../hooks/chat/useFirebaseDataListener';

import Message from './Message/Message';

import 'emoji-mart/css/emoji-mart.css'
import { Picker } from 'emoji-mart'

import { InputAdornment, IconButton, TextField, Divider, Fab, Zoom, Tooltip, Grow, Snackbar, CircularProgress } from '@material-ui/core';
import SendOutlinedIcon from '@material-ui/icons/SendOutlined';
import ExpandMoreOutlinedIcon from '@material-ui/icons/ExpandMoreOutlined';
import AttachFileIcon from '@material-ui/icons/AttachFile';
import CancelOutlinedIcon from '@material-ui/icons/CancelOutlined';
import SentimentVerySatisfiedOutlinedIcon from '@material-ui/icons/SentimentVerySatisfiedOutlined';

import { v4 as uuidv4 } from 'uuid';

const ChannelChat = props => {
    const { server, channel } = props;

    const auth = useAuth();
    const [messageList, setMessageList] = useState([]);
    const [newMessageText, setNewMessageText] = useState("");
    const [newFileName, setNewFileName] = useState(false);
    const [newFileUpload, setNewFileUpload] = useState(false);
    const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false);
    const [chatRows, setChatRows] = useState(1);
    const [messageSending, setMessageSending] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState("");
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [emojiTarget, setEmojiTarget] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [fetchingMessages, setFetchingMessages] = useState(false);
    const [messagesExhausted, setMessagesExhausted] = useState(false);

    const messagesEndRef = useRef(null);
    const messageListRef = useRef(null);
    const chatScrollerRef = useRef(null);

    const serverChannelMessagesPath = `/serverMessages/${server}/${channel}`;
    const channelMessages = useFirebaseDataListener(serverChannelMessagesPath);

    const clearFileUpload = useCallback(() => {
        if (messageSending)
            return
        setNewFileName(false);
        setNewFileUpload(false);
    }, [messageSending]);

    const openEmojiReactionMenu = useCallback((messageKey = false) => {
        if (showEmojiPicker) {
            setShowEmojiPicker(false);
        } else {
            setEmojiTarget(messageKey);
            setShowEmojiPicker(true);
        }
    }, [showEmojiPicker])

    const sendMessage = useCallback(() => {
        const downscaleImage = (img, newWidth = 500, imageType = "image/jpeg", quality = 0.8) => {
            // Create a temporary image so that we can compute the height of the downscaled image.
            const oldWidth = img.width;
            const oldHeight = img.height;
            const rescale = newWidth < oldWidth;
            const newHeight = rescale ? Math.floor(oldHeight / oldWidth * newWidth) : oldHeight

            // Create a temporary canvas to draw the downscaled image on.
            const canvas = document.createElement("canvas");
            canvas.width = rescale ? newWidth : oldWidth;
            canvas.height = newHeight;

            // Draw the downscaled image on the canvas and return the new data URL.
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, newWidth, newHeight);
            const newDataUrl = canvas.toDataURL(imageType, quality);
            return newDataUrl;
        }

        if ((!newMessageText && !newFileUpload) || messageSending) {
            return
        }
        setMessageSending(true);
        const uploadMessage = (filePath = false) => {
            const messageDetails = {
                userUID: auth.user.uid,
                message: newMessageText,
                file: filePath,
                timestamp: new Date().toUTCString()
            }
            const serverChannelMessagesRef = firebase.database().ref(serverChannelMessagesPath);
            serverChannelMessagesRef.push(messageDetails, error => {
                if (error) {
                    setSnackbarMessage("Could not send, please try again.");
                    setSnackbarOpen(true);
                } else {
                    setNewMessageText("");
                }
                clearFileUpload();
                setMessageSending(false);
                setChatRows(1);
            })
        }
        if (newFileUpload) {
            const uuid = uuidv4();
            const downscaledImagedDataUrl = downscaleImage(newFileUpload.compressed);
            const compressedStorRef = firebase.storage().ref(`serverChatImages/${server}/${channel}/${uuid}`);
            compressedStorRef.putString(downscaledImagedDataUrl, 'data_url') //newFileUpload
                .then(ret => {
                    const filePath = ret.ref.fullPath;
                    uploadMessage(filePath);
                    const uncompressedStorRef = firebase.storage().ref(`serverChatImages/${server}/${channel}/uncompressed/${uuid}`);
                    uncompressedStorRef.put(newFileUpload.uncompressed)
                })
                .catch(e => {
                    setSnackbarMessage("Could not upload file, please try again.");
                    setSnackbarOpen(true);
                    setMessageSending(false);
                });
        } else {
            uploadMessage();
        };
    }, [serverChannelMessagesPath, newMessageText, newFileUpload, auth.user.uid,
        channel, server, messageSending, setMessageSending, clearFileUpload])

    // Set CTRL + Enter key listener to send new messages.
    // Clean event listener on component unmount.
    useEffect(() => {
        const sendMessageKeyListener = (event) => {
            if (event.ctrlKey && event.key === 'Enter' && (newMessageText || newFileUpload)) {
                sendMessage();
            }
        }
        document.addEventListener('keyup', sendMessageKeyListener)
        return () => document.removeEventListener('keyup', sendMessageKeyListener)
    }, [sendMessage, newMessageText, newFileUpload]);

    // Clear displayed messages when user changes server or channel.
    useEffect(() => {
        setMessageList([]);
    }, [server, channel])

    // When firebase sends a value event for new message update the display.
    useEffect(() => {
        if (channelMessages) {
            const messages = Object.keys(channelMessages).map((key) => {
                const messageDetails = channelMessages[key];
                return (
                    <React.Fragment key={key}>
                        <Message messageKey={key} messageDetails={messageDetails} server={server} channel={channel} openEmojiReactionMenu={() => openEmojiReactionMenu(key)} />
                        <Divider style={{ backgroundColor: "#484c52" }} className={css.Divider} />
                    </React.Fragment>
                )
            });
            setMessageList(messages);
        }
    }, [channelMessages, server, channel, openEmojiReactionMenu])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    const fetchEarlierMessages = () => {
        if(!fetchingMessages && !messagesExhausted) {
            setFetchingMessages(true)
            console.log("TODO fetch earlier messages")
            //TODO
        }
    }

    const toggleBottomScrollVisibility = event => {
        const scroller = chatScrollerRef.current;
        const scrollPercentInverted = (scroller.scrollTop / (scroller.scrollHeight - scroller.clientHeight)) * 100;
        const scrollPercent = scrollPercentInverted * -1;
        setShowScrollToBottomButton(scrollPercent > 30);
        if(scrollPercent > 95)
            fetchEarlierMessages();

    }

    const updateMessageText = evt => {
        const messageText = evt.target.value;
        const rows = messageText.split(/\r\n|\r|\n/).length
        setNewMessageText(messageText)
        setChatRows(rows < 7 ? rows : 6);
    }

    const handleFileUploadSelected = (target) => {
        const showImageError = (errorMessage) => {
            setNewFileUpload(null);
            setSnackbarMessage(errorMessage);
            setSnackbarOpen(true);
        }
        const doPreliminaryValidation = imageFile => {
            let error = false;
            const isImage = imageFile.type.includes('image');
            const isImageTooLarge = imageFile.size > 8388608; //8MB
            if (!isImage) {
                error = 'Invalid image content. Please try another image.';
            } else if (isImageTooLarge) {
                error = 'File too large, maximum size 8MB.';
            }
            return error;
        }
        const imageFile = target.files[0];
        if (imageFile) {
            const error = doPreliminaryValidation(imageFile)
            if (error) {
                showImageError(error);
                return;
            }
            const img = new Image();
            img.onload = () => {
                setNewFileName(imageFile.name);
                setNewFileUpload({ compressed: img, uncompressed: imageFile });
                setSnackbarMessage("");
                setSnackbarOpen(false);
            };
            img.onerror = () => showImageError('Invalid image content. Please try another image.');
            const fileURI = URL.createObjectURL(imageFile);
            img.src = fileURI;
        }
    }

    const closeSnackbar = (event, reason) => {
        if (reason === 'clickaway')
            return
        setSnackbarOpen(false);
    }

    const handleEmojiSelect = emoji => {
        if (!emojiTarget) {
            setNewMessageText(prev => prev + emoji.native);
        } else {
            const messageReactionRef = firebase.database().ref(`serverMessages/${server}/${channel}/${emojiTarget}/reactions/${emoji.native}`);
            const update = { [auth.user.uid]: true };
            messageReactionRef.update(update);
        }
    }

    const clearEmojiPicker = () => {
        if (showEmojiPicker) {
            setEmojiTarget(false);
            setShowEmojiPicker(false);
        }
    }

    const wrapperClasses = ["FlexColStartCentered", css.ChannelChat];
    return (
        <div className={wrapperClasses.join(' ')}>
            <div ref={chatScrollerRef} onScroll={toggleBottomScrollVisibility} className={css.ReverseScrolling} onClick={clearEmojiPicker}>
                <div ref={messageListRef} className={css.MessageList}>
                    {messageList}
                    <div ref={messagesEndRef}></div>
                    {messageSending && <CircularProgress size={50} />}
                </div>
            </div>

            <div className={css.NewMessageInput}>
                <TextField
                    variant="outlined"
                    autoComplete={"false"}
                    fullWidth
                    multiline
                    rows={chatRows}
                    placeholder={`Message ${channel}`}
                    disabled={messageSending}
                    value={newMessageText}
                    onChange={evt => updateMessageText(evt)}
                    InputProps={{
                        style: { color: "#f9f9f9", fontFamily: "Roboto" },
                        startAdornment: (
                            <InputAdornment>
                                {!newFileName ?
                                    <Tooltip title="Upload an image">
                                        <IconButton style={{ color: "#f9f9f9" }} component="label" disabled={messageSending}>
                                            <AttachFileIcon />
                                            <input type="file" accept="image/*;capture=camera" onChange={evt => handleFileUploadSelected(evt.target)} hidden />
                                        </IconButton>
                                    </Tooltip>
                                    :
                                    <Tooltip title={`Remove ${newFileName}`}>
                                        <IconButton onClick={clearFileUpload} style={{ color: "#f9f9f9" }}>
                                            <CancelOutlinedIcon />
                                        </IconButton>
                                    </Tooltip>
                                }
                                <IconButton style={{ color: "#f9f9f9" }} onClick={() => openEmojiReactionMenu()}>
                                    <SentimentVerySatisfiedOutlinedIcon />
                                </IconButton>
                            </InputAdornment>
                        ),
                        endAdornment: (
                            <Grow in={Boolean(newFileUpload) || Boolean(newMessageText)}>
                                <InputAdornment>
                                    <Tooltip title="Ctrl + Enter also sends!">
                                        <IconButton onClick={sendMessage} style={{ color: "#f9f9f9" }}>
                                            <SendOutlinedIcon />
                                        </IconButton>
                                    </Tooltip>
                                </InputAdornment>
                            </Grow>
                        )
                    }}
                />
            </div>

            <div className={css.ScrollToBottom} >
                <Zoom in={showScrollToBottomButton} timeout={{ enter: 300, exit: 300 }} unmountOnExit >
                    <Fab onClick={scrollToBottom}>
                        <ExpandMoreOutlinedIcon />
                    </Fab>
                </Zoom>
            </div>

            {showEmojiPicker && <div className={css.EmojiPickerWrapper}><Picker emoji="" title="" onSelect={handleEmojiSelect} /></div>}
            <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={closeSnackbar} message={snackbarMessage} />
        </div>
    )
};

const arePropsEqual = (prevState, nextState) => true;

export default React.memo(ChannelChat, arePropsEqual);
