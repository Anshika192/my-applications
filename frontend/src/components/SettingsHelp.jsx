import React from 'react';

const SettingsHelp = ({ onBack }) => {
    return (
        <div className="settings-help-container">
            <div className="settings-help-header">
                <button className="back-btn" onClick={onBack}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    <span>Back</span>
                </button>
            </div>

            <div className="help-content-scroll">
                <div className="help-hero">
                    <h1>Welcome to our user's guide</h1>
                    <p>Although we have tried to make it really simple, here is a short guidance to help you through the editing process.</p>
                </div>

                <div className="help-section">
                    <div className="help-category-title">CONVERT & COMPRESS</div>

                    {/* Image to PDF */}
                    <div className="help-item">
                        <div className="help-item-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                            </svg>
                        </div>
                        <div className="help-item-content">
                            <h3>Image to PDF</h3>
                            <p>Upload your images and convert them into a single PDF file. Arrange images in order before downloading.</p>
                        </div>
                    </div>

                    {/* Image Compressor */}
                    <div className="help-item">
                        <div className="help-item-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="4 14 10 14 10 20"></polyline>
                                <polyline points="20 10 14 10 14 4"></polyline>
                                <line x1="14" y1="10" x2="21" y2="3"></line>
                                <line x1="3" y1="21" x2="10" y2="14"></line>
                            </svg>
                        </div>
                        <div className="help-item-content">
                            <h3>Image Compressor</h3>
                            <p>Compress your images while maintaining high quality. Ideal for saving space and web use.</p>
                        </div>
                    </div>

                    {/* Image Format Converter */}
                    <div className="help-item">
                        <div className="help-item-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16v16H4z"></path>
                                <polyline points="4,20 20,4"></polyline>
                                <polyline points="4,4 20,20"></polyline>
                            </svg>
                        </div>
                        <div className="help-item-content">
                            <h3>Image Format Converter</h3>
                            <p>Convert images between PNG, JPG, and WEBP formats. Upload your image, select format, and download.</p>
                        </div>
                    </div>

                    {/* Word to PDF */}
                    <div className="help-item">
                        <div className="help-item-icon">
                            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                        </div>
                        <div className="help-item-content">
                            <h3>Word to PDF</h3>
                            <p>Convert DOC or DOCX files into PDF preserving formatting and images.</p>
                        </div>
                    </div>

                    {/* PDF to Word */}
                    <div className="help-item">
                        <div className="help-item-icon">
                            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <path d="M12 18v-6l4 3-4 3z"></path>
                            </svg>
                        </div>
                        <div className="help-item-content">
                            <h3>PDF to Word</h3>
                            <p>Convert PDF files to editable Word documents keeping formatting intact.</p>
                        </div>
                    </div>

                    {/* PDF Merger */}
                    <div className="help-item">
                        <div className="help-item-icon">
                            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="3" y1="9" x2="21" y2="9"></line>
                                <line x1="3" y1="15" x2="21" y2="15"></line>
                            </svg>
                        </div>
                        <div className="help-item-content">
                            <h3>PDF Merger</h3>
                            <p>Merge multiple PDF files into a single PDF. Upload files in desired order and download merged PDF.</p>
                        </div>
                    </div>

                    {/* PDF to Text */}
                    <div className="help-item">
                        <div className="help-item-icon">
                            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="6" y1="9" x2="18" y2="9"></line>
                                <line x1="6" y1="13" x2="18" y2="13"></line>
                                <line x1="6" y1="17" x2="18" y2="17"></line>
                            </svg>
                        </div>
                        <div className="help-item-content">
                            <h3>PDF to Text</h3>
                            <p>Extract text from PDF files easily. Upload PDF and copy or download the text content.</p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default SettingsHelp;