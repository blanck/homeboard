import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  ImageBackground,
  TouchableOpacity,
  Pressable,
  Linking,
  Animated,
} from 'react-native';
import Svg, {Defs, LinearGradient as SvgLinearGradient, Rect, Stop} from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import useStore from '../store';
import {formatArticleContent} from '../utils/formatting';
import {fs, sp} from '../utils/scale';
import ArticleReader from './ArticleReader';

const PANEL_BG = '#16162a';

// RSS thumbnails are typically a few hundred pixels wide; stretched across the
// header they look washed out and cropped. Anything narrower than this gets a
// classic two-column treatment instead, image left and text right.
const HERO_MIN_WIDTH = 900;

// Blends the bottom edge of the image into the text panel
const ImageFade = () => (
  <Svg width="100%" height="100%" style={styles.imageFade} preserveAspectRatio="none">
    <Defs>
      <SvgLinearGradient id="newsFade" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={PANEL_BG} stopOpacity="0" />
        <Stop offset="1" stopColor={PANEL_BG} stopOpacity="1" />
      </SvgLinearGradient>
    </Defs>
    <Rect width="100%" height="100%" fill="url(#newsFade)" />
  </Svg>
);

const NewsPopup = () => {
  const visible = useStore((s) => s.newsPopupVisible);
  const article = useStore((s) => s.currentArticle);
  const hideArticle = useStore((s) => s.hideArticle);
  const lang = useStore((s) => s.config.language || 'en');
  const scale = useRef(new Animated.Value(0.9)).current;
  const [imageWidth, setImageWidth] = useState(null);

  useEffect(() => {
    if (visible) {
      scale.setValue(0.9);
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 220,
        mass: 0.8,
      }).start();
    }
  }, [visible, scale]);

  // Layout depends on the real pixel size, which only the loaded image knows.
  // Must sit above the `if (!article)` return: hooks run on every render.
  const imageUrl = article?.urlToImage || null;
  useEffect(() => {
    setImageWidth(null);
    if (!imageUrl) return undefined;
    let active = true;
    Image.getSize(
      imageUrl,
      (width) => active && setImageWidth(width),
      () => active && setImageWidth(0),
    );
    return () => {
      active = false;
    };
  }, [imageUrl]);

  if (!article) {
    return null;
  }

  if (article.url) {
    return (
      <Modal
        visible={visible}
        animationType="fade"
        transparent={true}
        statusBarTranslucent={true}
        navigationBarTranslucent={true}
        onRequestClose={hideArticle}>
        <View style={styles.overlay}>
          {/* Backdrop as a sibling: on Android a Pressable around the WebView
              takes over its touches, so the article could not scroll */}
          <Pressable style={StyleSheet.absoluteFill} onPress={hideArticle} />
          <Animated.View style={[styles.popup, styles.readerPopup, {transform: [{scale}]}]}>
            <ArticleReader article={article} lang={lang} onClose={hideArticle} />
          </Animated.View>
        </View>
      </Modal>
    );
  }

  const hasImage = !!article.urlToImage;

  const isHero = hasImage && imageWidth !== null && imageWidth >= HERO_MIN_WIDTH;
  const isSideBySide = hasImage && imageWidth !== null && imageWidth > 0 && !isHero;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      onRequestClose={hideArticle}>
      <Pressable style={styles.overlay} onPress={hideArticle}>
        <Animated.View style={[styles.popup, {transform: [{scale}]}]}>
          <Pressable style={styles.popupInner} onPress={() => {}}>
            {isHero ? (
              // Wrapper owns the height: ImageBackground copies width/height
              // from its own style onto the inner image, which double-applies
              // percentages (40% of 40%)
              <View style={styles.imageArea}>
                <ImageBackground
                  source={{uri: article.urlToImage}}
                  style={styles.imageFill}
                  resizeMode="cover">
                  <ImageFade />
                </ImageBackground>
              </View>
            ) : null}

            <View style={styles.textArea}>
              <ScrollView
                contentContainerStyle={styles.textContent}
                showsVerticalScrollIndicator={false}>
                <View style={isSideBySide ? styles.columns : null}>
                  {isSideBySide ? (
                    <Image
                      source={{uri: article.urlToImage}}
                      style={styles.sideImage}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={isSideBySide ? styles.sideColumn : null}>
                    <Text style={styles.headerTitle}>{article.title}</Text>
                    {article.description ? (
                      <Text style={styles.ingress}>
                        {formatArticleContent(article.description)}
                      </Text>
                    ) : null}
                    {article.content ? (
                      <Text style={styles.body}>
                        {formatArticleContent(article.content)}
                      </Text>
                    ) : null}
                    <TouchableOpacity
                      onPress={() => Linking.openURL(article.url)}
                      style={styles.linkWrap}>
                      <Text style={styles.link}>
                        Read full article at {article.source?.name}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={hideArticle} hitSlop={10}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popup: {
    width: '75%',
    maxHeight: '85%',
    backgroundColor: PANEL_BG,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 24,
  },
  // Leaves a dark margin all round that also closes the reader when tapped
  readerPopup: {
    width: '90%',
    height: '90%',
    maxHeight: '90%',
  },
  // The popup hugs its content up to maxHeight, so short articles get a
  // compact card instead of a mostly empty panel
  popupInner: {
    flexShrink: 1,
    minHeight: 0,
  },
  imageArea: {
    height: sp(230),
    width: '100%',
    flexShrink: 0,
  },
  imageFill: {
    flex: 1,
  },
  imageFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
  },
  textArea: {
    flexShrink: 1,
    minHeight: 0,
    backgroundColor: PANEL_BG,
  },
  textContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sideImage: {
    width: sp(240),
    height: sp(165),
    borderRadius: 8,
    marginRight: 18,
    flexShrink: 0,
    backgroundColor: '#222',
  },
  // minWidth 0 lets long headlines wrap instead of stretching the row
  sideColumn: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: fs(22),
    fontWeight: 'bold',
    lineHeight: fs(28),
    marginBottom: 12,
    paddingRight: 24,
  },
  ingress: {
    color: '#ffffff',
    fontSize: fs(16),
    fontStyle: 'italic',
    lineHeight: fs(23),
    marginBottom: 12,
  },
  body: {
    color: '#cccccc',
    fontSize: fs(15),
    lineHeight: fs(23),
    marginBottom: 14,
  },
  linkWrap: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  link: {
    color: '#7eb8e6',
    fontSize: fs(14),
    fontWeight: '600',
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default NewsPopup;
